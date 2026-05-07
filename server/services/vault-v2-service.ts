import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  or,
} from "drizzle-orm";
import {
  userClinicalProfiles,
  userMemories,
  vaultDocuments,
  vaultDocumentChunks,
  vaultDocumentEvents,
  vaultDocumentRuns,
} from "../../db/schema.js";
import { KimiApiClient } from "../kimi/api-client.js";
import { logServerError } from "../lib/debug.js";
import { getDb } from "../queries/connection.js";
import {
  deleteVaultDocumentOriginal,
  readVaultDocumentOriginal,
  storeVaultDocumentOriginal,
} from "./vault-v2-storage.js";
import {
  buildClinicalProfile,
  buildVaultDocumentChunks,
  computeVaultDocumentContentHash,
  isMedicalVaultCategory,
  normalizeExtractedDocumentText,
  resolveVaultQueryMode,
  selectVaultDocumentChunksForPrompt,
  type VaultDocumentCategory,
  type VaultDocumentChunk,
  type VaultRunStage,
} from "./vault-v2.js";
import { inferVaultCategorySuggestionFromContent } from "../../src/lib/vault-classification.js";

const execFileAsync = promisify(execFile);
const WORKER_SCAN_INTERVAL_MS = 4_000;
const workerState = {
  started: false,
  timer: null as ReturnType<typeof setInterval> | null,
  activeRuns: new Set<number>(),
};

type CreateVaultDocumentInput = {
  userId: number;
  filename: string;
  mimeType: string;
  category: VaultDocumentCategory;
  bytes: Uint8Array;
};

type VaultDocumentRecord = typeof vaultDocuments.$inferSelect;
type VaultDocumentRunRecord = typeof vaultDocumentRuns.$inferSelect;

function normalizeVaultDocument(record: VaultDocumentRecord, latestRun?: VaultDocumentRunRecord | null) {
  const classification =
    record.extractedText && record.mimeType
      ? inferVaultCategorySuggestionFromContent({
          fileName: record.filename,
          mimeType: record.mimeType,
          content: normalizeExtractedDocumentText(record.extractedText).text,
          currentCategory: record.category,
        })
      : null;

  return {
    id: record.id,
    filename: record.filename,
    mimeType: record.mimeType,
    category: record.category,
    sizeBytes: record.sizeBytes,
    status: record.status,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    readyAt: record.readyAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    categorySuggested: classification?.category ?? null,
    categoryConfidence: classification?.confidence ?? null,
    categoryMismatch: classification?.categoryMismatch ?? false,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          documentId: latestRun.documentId,
          status: latestRun.status,
          currentStage: latestRun.currentStage,
          attempt: latestRun.attempt,
          startedAt: latestRun.startedAt,
          finishedAt: latestRun.finishedAt,
        }
      : null,
  };
}

export function createVaultV2Service(deps?: {
  kimiClient?: Pick<KimiApiClient, "uploadFile" | "getFileContent" | "deleteFile">;
}) {
  const kimiClient = deps?.kimiClient ?? new KimiApiClient();

  return {
    async createDocument(input: CreateVaultDocumentInput) {
      const db = getDb();
      const [document] = await db
        .insert(vaultDocuments)
        .values({
          userId: input.userId,
          filename: input.filename,
          mimeType: input.mimeType || "application/octet-stream",
          category: input.category,
          sizeBytes: input.bytes.byteLength,
          status: "uploaded",
          updatedAt: new Date(),
        })
        .returning();

      const [run] = await db
        .insert(vaultDocumentRuns)
        .values({
          documentId: document.id,
          attempt: 1,
          status: "queued",
          currentStage: "store_original",
          updatedAt: new Date(),
        })
        .returning();

      await appendEvent(document.id, run.id, "store_original", "started");

      try {
        const originalRef = await storeVaultDocumentOriginal({
          userId: input.userId,
          filename: input.filename,
          contentType: input.mimeType || "application/octet-stream",
          bytes: input.bytes,
        });

        await db
          .update(vaultDocuments)
          .set({
            originalRef,
            updatedAt: new Date(),
          })
          .where(eq(vaultDocuments.id, document.id));
        await db
          .update(vaultDocumentRuns)
          .set({
            currentStage: "extract_text",
            updatedAt: new Date(),
          })
          .where(eq(vaultDocumentRuns.id, run.id));
        await appendEvent(document.id, run.id, "store_original", "completed");
        this.scheduleRun(run.id);

        return {
          document: normalizeVaultDocument({
            ...document,
            originalRef,
          }),
          run: {
            id: run.id,
            documentId: run.documentId,
            status: "queued",
            currentStage: "extract_text",
            attempt: run.attempt,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
          },
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Vault V2 failed while storing the original file.";

        await failRunAndDocument({
          documentId: document.id,
          runId: run.id,
          errorCode: "storage_failed",
          errorMessage: message,
          stage: "store_original",
        });

        return {
          document: normalizeVaultDocument({
            ...document,
            status: "failed",
            errorCode: "storage_failed",
            errorMessage: message,
          }),
          run: {
            id: run.id,
            documentId: run.documentId,
            status: "failed",
            currentStage: "store_original",
            attempt: run.attempt,
            startedAt: run.startedAt,
            finishedAt: new Date(),
          },
        };
      }
    },

    async listDocuments(userId: number) {
      const db = getDb();
      const documents = await db
        .select()
        .from(vaultDocuments)
        .where(eq(vaultDocuments.userId, userId))
        .orderBy(desc(vaultDocuments.createdAt));

      const latestRuns = await loadLatestRuns(
        documents.map(document => document.id),
      );

      return documents.map(document =>
        normalizeVaultDocument(document, latestRuns.get(document.id) ?? null),
      );
    },

    async getDocument(userId: number, documentId: number) {
      const document = await requireVaultDocumentOwner(documentId, userId);
      const latestRun = await loadLatestRunForDocument(document.id);

      return normalizeVaultDocument(document, latestRun);
    },

    async reclassifyDocument(params: {
      userId: number;
      documentId: number;
      category: VaultDocumentCategory;
      reprocess?: boolean;
    }) {
      const db = getDb();
      const document = await requireVaultDocumentOwner(params.documentId, params.userId);

      await db
        .update(vaultDocuments)
        .set({
          category: params.category,
          updatedAt: new Date(),
        })
        .where(eq(vaultDocuments.id, document.id));

      if (params.reprocess ?? true) {
        return this.reprocessDocument(params.userId, params.documentId);
      }

      const updated = await requireVaultDocumentOwner(params.documentId, params.userId);
      const latestRun = await loadLatestRunForDocument(updated.id);

      return {
        document: normalizeVaultDocument(updated, latestRun),
        run: latestRun
          ? {
              id: latestRun.id,
              documentId: latestRun.documentId,
              status: latestRun.status,
              currentStage: latestRun.currentStage,
              attempt: latestRun.attempt,
              startedAt: latestRun.startedAt,
              finishedAt: latestRun.finishedAt,
            }
          : null,
      };
    },

    async getDocumentEvents(userId: number, documentId: number) {
      await requireVaultDocumentOwner(documentId, userId);

      return getDb()
        .select()
        .from(vaultDocumentEvents)
        .where(eq(vaultDocumentEvents.documentId, documentId))
        .orderBy(desc(vaultDocumentEvents.createdAt));
    },

    async readDocumentOriginal(userId: number, documentId: number) {
      const document = await requireVaultDocumentOwner(documentId, userId);
      if (!document.originalRef) {
        throw new Error("Original file is not available for this document.");
      }

      return readVaultDocumentOriginal(document.originalRef);
    },

    async reprocessDocument(userId: number, documentId: number) {
      const db = getDb();
      const document = await requireVaultDocumentOwner(documentId, userId);
      const previousRuns = await db
        .select()
        .from(vaultDocumentRuns)
        .where(eq(vaultDocumentRuns.documentId, document.id))
        .orderBy(desc(vaultDocumentRuns.attempt))
        .limit(1);

      await db
        .delete(vaultDocumentChunks)
        .where(eq(vaultDocumentChunks.documentId, document.id));

      await db
        .update(vaultDocuments)
        .set({
          status: "uploaded",
          extractedText: null,
          contentHash: null,
          errorCode: null,
          errorMessage: null,
          readyAt: null,
          updatedAt: new Date(),
        })
        .where(eq(vaultDocuments.id, document.id));

      const [run] = await db
        .insert(vaultDocumentRuns)
        .values({
          documentId: document.id,
          attempt: (previousRuns[0]?.attempt ?? 0) + 1,
          status: "queued",
          currentStage: "extract_text",
          updatedAt: new Date(),
        })
        .returning();

      await appendEvent(document.id, run.id, "extract_text", "started", "Reprocess queued.");
      this.scheduleRun(run.id);

      return {
        document: normalizeVaultDocument({
          ...document,
          status: "uploaded",
          extractedText: null,
          contentHash: null,
          errorCode: null,
          errorMessage: null,
          readyAt: null,
        }),
        run: {
          id: run.id,
          documentId: run.documentId,
          status: run.status,
          currentStage: run.currentStage,
          attempt: run.attempt,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        },
      };
    },

    async deleteDocument(userId: number, documentId: number) {
      const db = getDb();
      const document = await requireVaultDocumentOwner(documentId, userId);
      await deleteVaultDocumentOriginal(document.originalRef);
      await db.delete(vaultDocuments).where(eq(vaultDocuments.id, document.id));
      await rebuildClinicalProfileForUser(userId, null);
      await syncVaultProfileMemory(userId, null);
      return { success: true };
    },

    async loadContext(params: {
      userId: number;
      allowedCategories: VaultDocumentCategory[];
      query: string;
      maxChunks?: number;
    }) {
      if (params.allowedCategories.length === 0) {
        return {
          clinicalProfileSummary: null,
          selectedVaultChunks: [] as VaultDocumentChunk[],
          relatedVaultDocuments: [] as Array<{
            id: number;
            filename: string;
            category: VaultDocumentCategory;
          }>,
        };
      }

      const queryMode = resolveVaultQueryMode({
        query: params.query,
        allowedCategories: params.allowedCategories,
      });
      const documentLimit =
        queryMode === "global_bloodwork_review" &&
        params.allowedCategories.includes("bloodwork")
          ? 16
          : 8;

      const readyDocuments = await getDb()
        .select()
        .from(vaultDocuments)
        .where(
          and(
            eq(vaultDocuments.userId, params.userId),
            eq(vaultDocuments.status, "ready"),
            inArray(vaultDocuments.category, params.allowedCategories),
          ),
        )
        .orderBy(desc(vaultDocuments.updatedAt))
        .limit(documentLimit);

      const clinicalProfile = buildClinicalProfile({
        documents: readyDocuments.map(document => ({
          id: document.id,
          category: document.category,
          filename: document.filename,
          extractedText: document.extractedText,
        })),
      });

      const includedDocumentIds = new Set(
        (
          clinicalProfile?.structuredData.documentSummaries ?? []
        )
          .filter(summary => !summary.categoryMismatch)
          .map(summary => summary.documentId),
      );
      const documentsForChunks =
        includedDocumentIds.size > 0
          ? readyDocuments.filter(document => includedDocumentIds.has(document.id))
          : readyDocuments;

      const storedChunks = await loadDocumentChunks(documentsForChunks);
      const selectedVaultChunks = selectVaultDocumentChunksForPrompt({
        query: params.query,
        chunks: storedChunks,
        mode: queryMode,
        maxChunks:
          queryMode === "global_bloodwork_review"
            ? Math.max(8, params.maxChunks ?? 10)
            : params.maxChunks ?? 4,
      });

      return {
        clinicalProfileSummary: clinicalProfile?.summaryText ?? null,
        selectedVaultChunks,
        relatedVaultDocuments: documentsForChunks.map(document => ({
          id: document.id,
          filename: document.filename,
          category: document.category,
        })),
      };
    },

    scheduleRun(runId: number) {
      queueMicrotask(() => {
        void this.processRun(runId).catch(error => {
          logServerError("vault-v2.run.process.failed", error, { runId });
        });
      });
    },

    async processRun(runId: number) {
      if (workerState.activeRuns.has(runId)) {
        return;
      }

      workerState.activeRuns.add(runId);

      try {
        const db = getDb();
        const [run] = await db
          .select()
          .from(vaultDocumentRuns)
          .where(eq(vaultDocumentRuns.id, runId))
          .limit(1);

        if (!run || (run.status !== "queued" && run.status !== "running")) {
          return;
        }

        const [document] = await db
          .select()
          .from(vaultDocuments)
          .where(eq(vaultDocuments.id, run.documentId))
          .limit(1);

        if (!document || !document.originalRef) {
          await failRunAndDocument({
            documentId: run.documentId,
            runId,
            errorCode: "missing_original",
            errorMessage: "Vault V2 could not find the stored original file.",
            stage: "extract_text",
          });
          return;
        }

        await db
          .update(vaultDocumentRuns)
          .set({
            status: "running",
            currentStage: "extract_text",
            startedAt: run.startedAt ?? new Date(),
            updatedAt: new Date(),
          })
          .where(eq(vaultDocumentRuns.id, runId));
        await db
          .update(vaultDocuments)
          .set({
            status: "extracting",
            errorCode: null,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(vaultDocuments.id, document.id));
        await appendEvent(document.id, runId, "extract_text", "started");

        const original = await readVaultDocumentOriginal(document.originalRef);
        const extraction = await extractVaultDocumentText({
          filename: document.filename,
          mimeType: document.mimeType,
          bytes: original.bytes,
          kimiClient,
        });
        const rawExtractedText = extraction.text;

        if (!rawExtractedText?.trim()) {
          await failRunAndDocument({
            documentId: document.id,
            runId,
            errorCode: "empty_extraction",
            errorMessage: "Vault V2 could not extract usable text from this file.",
            stage: "extract_text",
          });
          return;
        }

        await appendEvent(document.id, runId, "normalize_extracted_text", "started");
        const normalizedExtraction = normalizeExtractedDocumentText(rawExtractedText);
        const extractedText = normalizedExtraction.text;

        if (
          !extractedText?.trim() ||
          (
            normalizedExtraction.normalizedTextLength < 32 &&
            normalizedExtraction.rawTextLength > 256
          )
        ) {
          await failRunAndDocument({
            documentId: document.id,
            runId,
            errorCode: "empty_normalized_extraction",
            errorMessage: "Vault V2 normalized the extracted file content down to an unusable result.",
            stage: "extract_text",
          });
          return;
        }

        await appendEvent(document.id, runId, "extract_text", "completed", null, {
          source: extraction.source,
          rawTextLength: rawExtractedText.length,
        });
        await appendEvent(document.id, runId, "normalize_extracted_text", "completed", null, {
          source: extraction.source,
          rawTextLength: normalizedExtraction.rawTextLength,
          normalizedTextLength: normalizedExtraction.normalizedTextLength,
          normalizationApplied: normalizedExtraction.normalizationApplied,
          qualityWarnings: normalizedExtraction.qualityWarnings,
        });
        await appendEvent(document.id, runId, "index_chunks", "started");

        const chunks = buildVaultDocumentChunks({
          documentId: document.id,
          content: extractedText,
        });

        await db
          .update(vaultDocuments)
          .set({
            extractedText,
            contentHash: computeVaultDocumentContentHash(extractedText),
            updatedAt: new Date(),
          })
          .where(eq(vaultDocuments.id, document.id));

        await db
          .delete(vaultDocumentChunks)
          .where(eq(vaultDocumentChunks.documentId, document.id));

        if (chunks.length > 0) {
          await db.insert(vaultDocumentChunks).values(
            chunks.map(chunk => ({
              documentId: chunk.documentId,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
            })),
          );
        }

        await db
          .update(vaultDocumentRuns)
          .set({
            currentStage: "build_profile",
            updatedAt: new Date(),
          })
          .where(eq(vaultDocumentRuns.id, runId));
        await appendEvent(document.id, runId, "index_chunks", "completed", null, {
          chunkCount: chunks.length,
        });
        await appendEvent(document.id, runId, "build_profile", "started");

        await db
          .update(vaultDocuments)
          .set({
            status: "profiling",
            updatedAt: new Date(),
          })
          .where(eq(vaultDocuments.id, document.id));

        const clinicalProfile = await rebuildClinicalProfileForUser(document.userId, {
          id: document.id,
          category: document.category,
          filename: document.filename,
          extractedText,
        });
        await appendEvent(document.id, runId, "build_profile", "completed");

        await db
          .update(vaultDocumentRuns)
          .set({
            currentStage: "sync_memory",
            updatedAt: new Date(),
          })
          .where(eq(vaultDocumentRuns.id, runId));
        await appendEvent(document.id, runId, "sync_memory", "started");

        await syncVaultProfileMemory(document.userId, clinicalProfile?.summaryText ?? null);
        await appendEvent(document.id, runId, "sync_memory", "completed");

        await db
          .update(vaultDocuments)
          .set({
            status: "ready",
            errorCode: null,
            errorMessage: null,
            readyAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(vaultDocuments.id, document.id));

        await db
          .update(vaultDocumentRuns)
          .set({
            status: "completed",
            currentStage: "completed",
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(vaultDocumentRuns.id, runId));
        await appendEvent(document.id, runId, "completed", "completed");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Vault V2 run failed unexpectedly.";
        logServerError("vault-v2.run.unhandled", error, { runId });

        const db = getDb();
        const [run] = await db
          .select()
          .from(vaultDocumentRuns)
          .where(eq(vaultDocumentRuns.id, runId))
          .limit(1);

        if (run) {
          await failRunAndDocument({
            documentId: run.documentId,
            runId,
            errorCode: "ingestion_failed",
            errorMessage: message,
            stage: normalizeStage(run.currentStage),
          });
        }
      } finally {
        workerState.activeRuns.delete(runId);
      }
    },

    async recoverPendingRuns() {
      const db = getDb();
      const pendingRuns = await db
        .select()
        .from(vaultDocumentRuns)
        .where(
          or(
            eq(vaultDocumentRuns.status, "queued"),
            eq(vaultDocumentRuns.status, "running"),
          ),
        )
        .orderBy(vaultDocumentRuns.createdAt)
        .limit(8);

      for (const run of pendingRuns) {
        if (workerState.activeRuns.has(run.id)) {
          continue;
        }

        this.scheduleRun(run.id);
      }
    },

    startWorker() {
      if (workerState.started) {
        return;
      }

      workerState.started = true;
      workerState.timer = setInterval(() => {
        void this.recoverPendingRuns().catch(error => {
          logServerError("vault-v2.worker.scan.failed", error);
        });
      }, WORKER_SCAN_INTERVAL_MS);

      void this.recoverPendingRuns().catch(error => {
        logServerError("vault-v2.worker.bootstrap.failed", error);
      });
    },
  };
}

export const vaultV2Service = createVaultV2Service();

async function appendEvent(
  documentId: number,
  runId: number | null,
  stage: string,
  status: string,
  message?: string | null,
  metadata?: Record<string, unknown>,
) {
  await getDb().insert(vaultDocumentEvents).values({
    documentId,
    runId,
    stage,
    status,
    message: message ?? null,
    metadata: metadata ?? {},
  });
}

async function failRunAndDocument(params: {
  documentId: number;
  runId: number;
  errorCode: string;
  errorMessage: string;
  stage: VaultRunStage;
}) {
  const db = getDb();
  await db
    .update(vaultDocuments)
    .set({
      status: "failed",
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      readyAt: null,
      updatedAt: new Date(),
    })
    .where(eq(vaultDocuments.id, params.documentId));
  await db
    .update(vaultDocumentRuns)
    .set({
      status: "failed",
      currentStage: params.stage,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(vaultDocumentRuns.id, params.runId));
  await appendEvent(
    params.documentId,
    params.runId,
    params.stage,
    "failed",
    params.errorMessage,
    {
      errorCode: params.errorCode,
    },
  );
}

async function requireVaultDocumentOwner(documentId: number, userId: number) {
  const [document] = await getDb()
    .select()
    .from(vaultDocuments)
    .where(and(eq(vaultDocuments.id, documentId), eq(vaultDocuments.userId, userId)))
    .limit(1);

  if (!document) {
    throw new Error("Vault document not found.");
  }

  return document;
}

async function loadLatestRuns(documentIds: number[]) {
  const map = new Map<number, VaultDocumentRunRecord>();
  if (documentIds.length === 0) {
    return map;
  }

  const runs = await getDb()
    .select()
    .from(vaultDocumentRuns)
    .where(inArray(vaultDocumentRuns.documentId, documentIds))
    .orderBy(desc(vaultDocumentRuns.createdAt));

  for (const run of runs) {
    if (!map.has(run.documentId)) {
      map.set(run.documentId, run);
    }
  }

  return map;
}

async function loadLatestRunForDocument(documentId: number) {
  const rows = await getDb()
    .select()
    .from(vaultDocumentRuns)
    .where(eq(vaultDocumentRuns.documentId, documentId))
    .orderBy(desc(vaultDocumentRuns.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function loadDocumentChunks(documents: VaultDocumentRecord[]) {
  if (documents.length === 0) {
    return [];
  }

  const stored = await getDb()
    .select()
    .from(vaultDocumentChunks)
    .where(
      inArray(
        vaultDocumentChunks.documentId,
        documents.map(document => document.id),
      ),
    )
    .orderBy(asc(vaultDocumentChunks.documentId), asc(vaultDocumentChunks.chunkIndex));

  if (stored.length > 0) {
    return stored.map(chunk => ({
      documentId: chunk.documentId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
    }));
  }

  return documents.flatMap(document =>
    buildVaultDocumentChunks({
      documentId: document.id,
      content: document.extractedText ?? "",
    }),
  );
}

async function rebuildClinicalProfileForUser(
  userId: number,
  draftDocument:
    | {
        id: number;
        category: VaultDocumentCategory;
        filename: string;
        extractedText: string;
      }
    | null,
) {
  const db = getDb();
  const readyDocuments = await db
    .select()
    .from(vaultDocuments)
    .where(
      and(
        eq(vaultDocuments.userId, userId),
        eq(vaultDocuments.status, "ready"),
        isNotNull(vaultDocuments.extractedText),
      ),
    )
    .orderBy(desc(vaultDocuments.updatedAt));

  const documentsForProfile = readyDocuments
    .filter(document => document.id !== draftDocument?.id)
    .map(document => ({
      id: document.id,
      category: document.category,
      filename: document.filename,
      extractedText: document.extractedText,
    }));

  if (draftDocument && isMedicalVaultCategory(draftDocument.category)) {
    documentsForProfile.unshift(draftDocument);
  }

  const profile = buildClinicalProfile({
    documents: documentsForProfile,
  });

  if (!profile) {
    await db
      .delete(userClinicalProfiles)
      .where(eq(userClinicalProfiles.userId, userId));
    return null;
  }

  const existing = await db
    .select()
    .from(userClinicalProfiles)
    .where(eq(userClinicalProfiles.userId, userId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(userClinicalProfiles)
      .set({
        summaryText: profile.summaryText,
        structuredData: profile.structuredData,
        sourceDocumentIds: profile.structuredData.sourceDocumentIds,
        updatedAt: new Date(),
      })
      .where(eq(userClinicalProfiles.userId, userId));
  } else {
    await db.insert(userClinicalProfiles).values({
      userId,
      summaryText: profile.summaryText,
      structuredData: profile.structuredData,
      sourceDocumentIds: profile.structuredData.sourceDocumentIds,
    });
  }

  return profile;
}

async function syncVaultProfileMemory(userId: number, summaryText: string | null) {
  const db = getDb();
  const existing = await db
    .select()
    .from(userMemories)
    .where(and(eq(userMemories.userId, userId), eq(userMemories.memoryKey, "vault_profile")))
    .orderBy(desc(userMemories.updatedAt))
    .limit(1);

  if (!summaryText?.trim()) {
    if (existing[0]) {
      await db.delete(userMemories).where(eq(userMemories.id, existing[0].id));
    }
    return;
  }

  if (existing[0]) {
    await db
      .update(userMemories)
      .set({
        value: summaryText,
        confidence: "0.95",
        updatedAt: new Date(),
      })
      .where(eq(userMemories.id, existing[0].id));
    return;
  }

  await db.insert(userMemories).values({
    userId,
    memoryKey: "vault_profile",
    value: summaryText,
    confidence: "0.95",
  });
}

function normalizeStage(value: string): VaultRunStage {
  switch (value) {
    case "store_original":
    case "extract_text":
    case "index_chunks":
    case "build_profile":
    case "sync_memory":
    case "completed":
      return value;
    default:
      return "extract_text";
  }
}

async function extractPdfTextWithPython(bytes: Uint8Array) {
  const pythonCandidates = [
    { command: process.env.AURA_LOCAL_PYTHON?.trim(), args: [] as string[] },
    { command: process.env.PYTHON?.trim(), args: [] as string[] },
    { command: "python", args: [] as string[] },
    { command: "py", args: ["-3"] },
  ].filter(candidate => Boolean(candidate.command)) as Array<{
    command: string;
    args: string[];
  }>;

  const extractionScript = [
    "import base64, io, sys",
    "from pypdf import PdfReader",
    "payload = base64.b64decode(sys.stdin.read())",
    "reader = PdfReader(io.BytesIO(payload))",
    "chunks = []",
    "for page in reader.pages:",
    "    chunks.append((page.extract_text() or '').strip())",
    "sys.stdout.write('\\n\\n'.join(chunk for chunk in chunks if chunk))",
  ].join("\n");
  const stdin = Buffer.from(bytes).toString("base64");

  for (const candidate of pythonCandidates) {
    try {
      const { stdout } = await execFileAsync(
        candidate.command,
        [...candidate.args, "-c", extractionScript],
        {
          input: stdin,
          timeout: 20_000,
          maxBuffer: 8 * 1024 * 1024,
          windowsHide: true,
        } as any,
      );
      const extracted = String(stdout ?? "").trim();
      if (extracted) {
        return extracted;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export async function extractVaultDocumentTextLocally(params: {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const normalizedMimeType = params.mimeType.toLowerCase();
  const ext = params.filename.split(".").pop()?.toLowerCase() ?? "";

  if (
    normalizedMimeType.startsWith("text/") ||
    normalizedMimeType === "application/json" ||
    normalizedMimeType === "application/x-ndjson" ||
    ["txt", "md", "csv", "json"].includes(ext)
  ) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(params.bytes);
    const normalized = text.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (normalizedMimeType === "application/pdf" || ext === "pdf") {
    return extractPdfTextWithPython(params.bytes);
  }

  return null;
}

export function shouldUseKimiPrimaryExtraction(mimeType: string, filename: string) {
  const normalizedMimeType = mimeType.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (normalizedMimeType === "application/pdf" || ext === "pdf") {
    return true;
  }

  if (
    normalizedMimeType.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"].includes(ext)
  ) {
    return true;
  }

  return false;
}

function canFallbackToRemoteExtraction(mimeType: string, filename: string) {
  if (shouldUseKimiPrimaryExtraction(mimeType, filename)) {
    return true;
  }

  const normalizedMimeType = mimeType.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (normalizedMimeType.startsWith("image/")) {
    return true;
  }

  return !["exe", "zip", "rar", "7z"].includes(ext);
}

async function extractVaultDocumentText(params: {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  kimiClient: Pick<KimiApiClient, "uploadFile" | "getFileContent" | "deleteFile">;
}) {
  const preferRemote = shouldUseKimiPrimaryExtraction(
    params.mimeType,
    params.filename,
  );

  if (preferRemote) {
    try {
      const text = await extractVaultDocumentTextWithKimi(params);
      if (text) {
        return {
          text,
          source: params.mimeType.toLowerCase().startsWith("image/")
            ? "kimi-ocr"
            : "kimi-file-extract",
        } as const;
      }
    } catch (error) {
      const fallbackText = await extractVaultDocumentTextLocally(params);
      if (fallbackText) {
        return {
          text: fallbackText,
          source: "local-fallback",
        } as const;
      }

      throw error;
    }

    const fallbackText = await extractVaultDocumentTextLocally(params);
    return {
      text: fallbackText,
      source: fallbackText ? ("local-fallback" as const) : ("none" as const),
    };
  }

  const localText = await extractVaultDocumentTextLocally(params);
  if (localText) {
    return {
      text: localText,
      source: "local",
    } as const;
  }

  if (!canFallbackToRemoteExtraction(params.mimeType, params.filename)) {
    return {
      text: null,
      source: "none",
    } as const;
  }

  const text = await extractVaultDocumentTextWithKimi(params);
  return {
    text,
    source: "kimi-file-extract",
  } as const;
}

async function extractVaultDocumentTextWithKimi(params: {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  kimiClient: Pick<KimiApiClient, "uploadFile" | "getFileContent" | "deleteFile">;
}) {
  let uploadedFileId: string | null = null;

  try {
    const uploaded = await params.kimiClient.uploadFile({
      filename: params.filename,
      contentType: params.mimeType,
      bytes: params.bytes,
      purpose: "file-extract",
    });
    uploadedFileId = uploaded.id;
    return (await params.kimiClient.getFileContent(uploaded.id)).trim();
  } finally {
    if (uploadedFileId && typeof params.kimiClient.deleteFile === "function") {
      await params.kimiClient.deleteFile(uploadedFileId).catch(() => undefined);
    }
  }
}

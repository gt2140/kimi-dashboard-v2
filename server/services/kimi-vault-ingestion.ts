import { eq } from "drizzle-orm";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { vaultChunks, vaultFiles } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";
import { KimiApiClient } from "../kimi/api-client.js";
import { buildVaultChunks, computeVaultContentHash } from "./kimi-vault.js";
import { storeOriginalVaultFile } from "./vault-original-file.js";

const execFileAsync = promisify(execFile);

type VaultCategory =
  | "bloodwork"
  | "genetics"
  | "wearables"
  | "body-composition"
  | "notes"
  | "other";

type IngestParams = {
  headers: Headers;
  userId: number;
  filename: string;
  fileType: string;
  category: VaultCategory;
  contentType: string;
  bytes: Uint8Array;
};

type PendingFileRecord = {
  id: number;
};

type ReadyFileUpdate = {
  status: "ready";
  extractionStatus: "ready";
  remoteFileId: string | null;
  extractedText: string;
  contentHash: string;
  extractedAt: Date;
  extractionError: null;
};

type FailedFileUpdate = {
  status: "failed";
  extractionStatus: "failed";
  extractionError: string;
};

type VaultIngestionRepository = {
  createPendingFile: (params: {
    userId: number;
    filename: string;
    fileType: string;
    category: VaultCategory;
    size: number;
    encryptedUrl: string | null;
  }) => Promise<PendingFileRecord>;
  updateOriginalReference: (id: number, encryptedUrl: string) => Promise<void>;
  markReady: (id: number, params: ReadyFileUpdate) => Promise<void>;
  markFailed: (id: number, params: FailedFileUpdate) => Promise<void>;
  insertChunks: (
    id: number,
    extractedText: string,
  ) => Promise<void>;
  getFileById: (id: number) => Promise<Record<string, unknown> | undefined>;
};

function createRepository(): VaultIngestionRepository {
  const db = getDb();

  return {
    async createPendingFile(params) {
      const inserted = await db
        .insert(vaultFiles)
        .values({
          userId: params.userId,
          filename: params.filename,
          fileType: params.fileType,
          category: params.category,
          size: params.size,
          status: "processing",
          extractionStatus: "pending",
          encryptedUrl: params.encryptedUrl,
          updatedAt: new Date(),
        })
        .returning({ id: vaultFiles.id });

      const row = inserted[0];
      if (!row?.id) {
        throw new Error("Failed to persist the Kimi vault file.");
      }

      return row;
    },

    async updateOriginalReference(id, encryptedUrl) {
      await db
        .update(vaultFiles)
        .set({
          encryptedUrl,
          updatedAt: new Date(),
        })
        .where(eq(vaultFiles.id, id));
    },

    async markReady(id, params) {
      await db
        .update(vaultFiles)
        .set({
          status: params.status,
          extractionStatus: params.extractionStatus,
          remoteFileId: params.remoteFileId,
          extractedText: params.extractedText,
          contentHash: params.contentHash,
          extractedAt: params.extractedAt,
          extractionError: params.extractionError,
          updatedAt: new Date(),
        })
        .where(eq(vaultFiles.id, id));
    },

    async markFailed(id, params) {
      await db
        .update(vaultFiles)
        .set({
          status: params.status,
          extractionStatus: params.extractionStatus,
          extractionError: params.extractionError,
          updatedAt: new Date(),
        })
        .where(eq(vaultFiles.id, id));
    },

    async insertChunks(id, extractedText) {
      const chunks = buildVaultChunks({
        vaultFileId: id,
        content: extractedText,
      });

      if (chunks.length > 0) {
        await db.insert(vaultChunks).values(chunks);
      }
    },

    async getFileById(id) {
      const rows = await db
        .select()
        .from(vaultFiles)
        .where(eq(vaultFiles.id, id))
        .limit(1);

      return rows[0];
    },
  };
}

export function createKimiVaultIngestionService(deps?: {
  repository?: VaultIngestionRepository;
  kimiClient?: Pick<KimiApiClient, "uploadFile" | "getFileContent">;
  storeOriginalVaultFile?: typeof storeOriginalVaultFile;
  extractVaultTextLocally?: typeof extractVaultTextLocally;
}) {
  const repository = deps?.repository ?? createRepository();
  const kimiClient = deps?.kimiClient ?? new KimiApiClient();
  const persistOriginalFile = deps?.storeOriginalVaultFile ?? storeOriginalVaultFile;
  const extractLocally = deps?.extractVaultTextLocally ?? extractVaultTextLocally;

  return {
    async ingest(params: IngestParams) {
      const pendingFile = await repository.createPendingFile({
        userId: params.userId,
        filename: params.filename,
        fileType: params.fileType,
        category: params.category,
        size: params.bytes.byteLength,
        encryptedUrl: null,
      });

      try {
        try {
          const encryptedUrl = await persistOriginalFile({
            headers: params.headers,
            userId: params.userId,
            filename: params.filename,
            contentType: params.contentType,
            bytes: params.bytes,
          });
          await repository.updateOriginalReference(pendingFile.id, encryptedUrl);
        } catch {
          // Original-file persistence is best-effort; context ingestion can still succeed.
        }

        const localExtractedText = await extractLocally({
          filename: params.filename,
          contentType: params.contentType,
          bytes: params.bytes,
        });

        let remoteFileId: string | null = null;
        let extractedText = localExtractedText;

        if (!extractedText) {
          const uploaded = await kimiClient.uploadFile({
            filename: params.filename,
            contentType: params.contentType,
            bytes: params.bytes,
          });
          remoteFileId = uploaded.id;
          extractedText = await kimiClient.getFileContent(uploaded.id);
        }

        if (!extractedText?.trim()) {
          throw new Error(
            "Kimi vault ingestion completed without extracted text for this file.",
          );
        }

        await repository.markReady(pendingFile.id, {
          status: "ready",
          extractionStatus: "ready",
          remoteFileId,
          extractedText,
          contentHash: computeVaultContentHash(extractedText),
          extractedAt: new Date(),
          extractionError: null,
        });
        await repository.insertChunks(pendingFile.id, extractedText);

        const saved = await repository.getFileById(pendingFile.id);
        if (!saved) {
          throw new Error("The vault file was saved but could not be reloaded.");
        }

        return saved;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Kimi vault upload failed unexpectedly.";

        await repository.markFailed(pendingFile.id, {
          status: "failed",
          extractionStatus: "failed",
          extractionError: message,
        });

        const saved = await repository.getFileById(pendingFile.id);
        if (saved) {
          return saved;
        }

        throw error;
      }
    },
  };
}

const defaultKimiVaultIngestionService = createKimiVaultIngestionService();

export async function ingestKimiVaultFile(params: IngestParams) {
  return defaultKimiVaultIngestionService.ingest(params);
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

  if (pythonCandidates.length === 0) {
    return null;
  }

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
      // Try the next available Python candidate.
    }
  }

  return null;
}

export async function extractVaultTextLocally(params: {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}) {
  const normalizedContentType = params.contentType.toLowerCase();
  const ext = params.filename.split(".").pop()?.toLowerCase() ?? "";
  const supportedTextExtensions = new Set(["txt", "md", "csv", "json"]);

  const shouldDecodeLocally =
    normalizedContentType.startsWith("text/") ||
    normalizedContentType === "application/json" ||
    normalizedContentType === "application/x-ndjson" ||
    supportedTextExtensions.has(ext);

  if (shouldDecodeLocally) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(params.bytes);
    const normalized = text.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (normalizedContentType === "application/pdf" || ext === "pdf") {
    return extractPdfTextWithPython(params.bytes);
  }

  return null;
}

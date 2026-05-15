import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { authenticateRequest } from "./trpc/auth.js";
import { chatSendMessageInputSchema } from "./trpc/chat-router.js";
import { TurnStreamController } from "./services/turn-stream-controller.js";
import { withAbortableTimeout } from "./services/async-guard.js";
import { auraChatConversationTurnRuntime } from "./services/venice-chat-runtime.js";
import { classifyApiError } from "./lib/api-errors.js";
import { logServerDebug } from "./lib/debug.js";
import { vaultV2Service } from "./services/vault-v2-service.js";
import { handleSimpleChatRequest } from "./chat/simple-chat-handler.js";
import { handleProviderCheckRequest } from "./chat/provider-check-handler.js";
import { handleDiagnoseTurnRequest } from "./chat/diagnose-turn-handler.js";

export const app = new Hono<{ Bindings: HttpBindings }>();

const CHAT_ROUTE_TIMEOUT_MS = 180_000;
const SHOULD_STREAM_PROVIDER_DIRECTLY = true;

function ensureVaultWorkerStarted() {
  vaultV2Service.startWorker();
}

function createNdjsonStreamResponse(
  c: Parameters<typeof stream>[0],
  run: (
    streamController: TurnStreamController,
    signal: AbortSignal
  ) => Promise<void>,
  details: {
    requestId: string;
    route: string;
    conversationId: number;
    userId: number;
    agentId: string;
  },
  label = "Chat stream"
) {
  c.header("Content-Type", "application/x-ndjson; charset=utf-8");
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  let streamController: TurnStreamController | null = null;
  let firstChunkSent = false;
  const clientAbortController = new AbortController();

  return stream(
    c,
    async honoStream => {
      honoStream.onAbort(() => {
        logServerDebug("chat.turn.stream.aborted", {
          ...details,
          firstChunkSent,
        });
        clientAbortController.abort(
          new Error("Client disconnected while streaming chat.")
        );
        streamController?.disconnect();
      });

      streamController = new TurnStreamController({
        write: async payload => {
          if (!firstChunkSent) {
            firstChunkSent = true;
            logServerDebug("chat.turn.stream.first-chunk", {
              ...details,
              payloadBytes: payload.length,
            });
          }

          await honoStream.write(payload);
        },
        close: async () => {
          logServerDebug("chat.turn.stream.close", {
            ...details,
            firstChunkSent,
          });
          await honoStream.close();
        },
      });

      try {
        const activeStreamController = streamController;
        if (!activeStreamController) {
          throw new Error("Chat stream controller was not initialized.");
        }

        await withAbortableTimeout(
          signal => run(activeStreamController, signal),
          {
            label,
            timeoutMs: CHAT_ROUTE_TIMEOUT_MS,
            signal: clientAbortController.signal,
          }
        );
      } catch (error) {
        const failure = classifyApiError(error);
        await streamController.fail(failure);
      }
    },
    async (error, honoStream) => {
      logServerDebug("chat.turn.stream.error", {
        ...details,
        firstChunkSent,
        error: error.message,
      });
      await honoStream.write(
        `${JSON.stringify({
          type: "error",
          message: error.message,
          category: classifyApiError(error).category,
          traceId: details.requestId,
        })}\n`
      );
    }
  );
}

app.use("/api/trpc/*", async c => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

export function shouldStreamProviderDirectlyInRoutes() {
  return SHOULD_STREAM_PROVIDER_DIRECTLY;
}

async function handleChatStreamRoute(c: Parameters<typeof stream>[0]) {
  const route = "/api/chat/stream";
  const authStartedAt = Date.now();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = chatSendMessageInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid request body.",
        details: parsed.error.flatten(),
      },
      400
    );
  }

  const requestId = globalThis.crypto.randomUUID().slice(0, 8);
  c.header("X-Trace-Id", requestId);
  return createNdjsonStreamResponse(
    c,
    async (streamController, signal) => {
      await streamController.emitAck({ traceId: requestId });
      logServerDebug("chat.turn.route.start", {
        requestId,
        route,
        conversationId: parsed.data.conversationId,
        agentId: parsed.data.agentId,
        userId: user.id,
        authMs: Date.now() - authStartedAt,
      });
      await streamController.emitStage({
        id: "memory",
        label: "Loading chat context",
      });
      const result = await auraChatConversationTurnRuntime.executeTurn({
        userId: user.id,
        conversationId: parsed.data.conversationId,
        content: parsed.data.content,
        agentId: parsed.data.agentId,
        requestedModelName: parsed.data.requestedModelName,
        stream: shouldStreamProviderDirectlyInRoutes(),
        signal,
        onStage: async stage => {
          await streamController.emitStage(stage);
        },
        onTextDelta: async delta => {
          await streamController.emitDelta(delta);
        },
      });

      if (result.assistantMessage) {
        await streamController.complete({
          id: String(result.assistantMessage.id),
          role: "assistant",
          content: result.assistantMessage.content,
          agentId: result.assistantMessage.agentId,
          createdAt: result.assistantMessage.createdAt.toISOString(),
          metadata: result.assistantMessage.metadata,
        });
        return;
      }

      await streamController.fail({
        message: "Chat turn finished without a persisted assistant message.",
        category: "backend-timeout",
        traceId: requestId,
      });
    },
    {
      requestId,
      route,
      conversationId: parsed.data.conversationId,
      userId: user.id,
      agentId: parsed.data.agentId,
    },
    "Aura chat turn"
  );
}

app.post("/api/chat/stream", async c => {
  return handleChatStreamRoute(c);
});

app.post("/api/chat/send", async c => {
  return handleSimpleChatRequest(c.req.raw);
});

app.on(["GET", "POST"], "/api/chat/provider-check", async c => {
  return handleProviderCheckRequest(c.req.raw);
});

app.post("/api/chat/diagnose-turn", async c => {
  return handleDiagnoseTurnRequest(c.req.raw);
});

app.post("/api/vault/documents", async c => {
  ensureVaultWorkerStarted();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get("file");
  const category = formData?.get("category");

  if (!(file instanceof File) || typeof category !== "string") {
    return c.json({ error: "file and category are required." }, 400);
  }

  try {
    logServerDebug("vault-v2.upload.start", {
      userId: user.id,
      filename: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      category,
    });
    const arrayBuffer = await file.arrayBuffer();
    const created = await vaultV2Service.createDocument({
      userId: user.id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      category: normalizeVaultCategory(category),
      bytes: new Uint8Array(arrayBuffer),
    });
    logServerDebug("vault-v2.upload.success", {
      userId: user.id,
      vaultDocumentId: created.document.id,
      filename: file.name,
    });

    return c.json(created, 201);
  } catch (error) {
    logServerDebug("vault-v2.upload.failed", {
      userId: user.id,
      filename: file.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault upload failed unexpectedly.",
      },
      500
    );
  }
});
app.get("/api/vault/documents", async c => {
  ensureVaultWorkerStarted();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const documents = await vaultV2Service.listDocuments(user.id);
    return c.json({ documents });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 list failed unexpectedly.",
      },
      500
    );
  }
});
app.get("/api/vault/documents/:id", async c => {
  ensureVaultWorkerStarted();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const documentId = Number(c.req.param("id"));
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return c.json({ error: "Invalid document id." }, 400);
  }

  try {
    const document = await vaultV2Service.getDocument(user.id, documentId);
    return c.json({ document });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 document load failed unexpectedly.",
      },
      404
    );
  }
});
app.get("/api/vault/documents/:id/events", async c => {
  ensureVaultWorkerStarted();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const documentId = Number(c.req.param("id"));
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return c.json({ error: "Invalid document id." }, 400);
  }

  try {
    const events = await vaultV2Service.getDocumentEvents(user.id, documentId);
    return c.json({ events });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 events failed unexpectedly.",
      },
      404
    );
  }
});
app.get("/api/vault/documents/:id/original", async c => {
  ensureVaultWorkerStarted();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const documentId = Number(c.req.param("id"));
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return c.json({ error: "Invalid document id." }, 400);
  }

  try {
    const document = await vaultV2Service.getDocument(user.id, documentId);
    const original = await vaultV2Service.readDocumentOriginal(
      user.id,
      documentId
    );

    return new Response(original.bytes, {
      headers: {
        "content-type": original.contentType,
        "content-disposition": `inline; filename="${document.filename}"`,
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 preview failed unexpectedly.",
      },
      404
    );
  }
});
app.post("/api/vault/documents/:id/reprocess", async c => {
  ensureVaultWorkerStarted();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const documentId = Number(c.req.param("id"));
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return c.json({ error: "Invalid document id." }, 400);
  }

  try {
    const result = await vaultV2Service.reprocessDocument(user.id, documentId);
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 reprocess failed unexpectedly.",
      },
      404
    );
  }
});
app.post("/api/vault/documents/:id/reclassify", async c => {
  ensureVaultWorkerStarted();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const documentId = Number(c.req.param("id"));
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return c.json({ error: "Invalid document id." }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const category =
    body && typeof body.category === "string"
      ? normalizeVaultCategory(body.category)
      : null;

  if (!category) {
    return c.json({ error: "A valid category is required." }, 400);
  }

  try {
    const result = await vaultV2Service.reclassifyDocument({
      userId: user.id,
      documentId,
      category,
      reprocess: body?.reprocess !== false,
    });
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 reclassify failed unexpectedly.",
      },
      404
    );
  }
});
app.delete("/api/vault/documents/:id", async c => {
  ensureVaultWorkerStarted();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const documentId = Number(c.req.param("id"));
  if (!Number.isFinite(documentId) || documentId <= 0) {
    return c.json({ error: "Invalid document id." }, 400);
  }

  try {
    const result = await vaultV2Service.deleteDocument(user.id, documentId);
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 delete failed unexpectedly.",
      },
      404
    );
  }
});
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));

export default app;

function normalizeVaultCategory(value: string) {
  switch (value) {
    case "bloodwork":
    case "genetics":
    case "wearables":
    case "body-composition":
    case "notes":
      return value;
    default:
      return "other" as const;
  }
}

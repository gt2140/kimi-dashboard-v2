import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { authenticateRequest } from "./trpc/auth.js";
import { chatSendMessageInputSchema } from "./trpc/chat-router.js";
import { TurnStreamController } from "./services/turn-stream-controller.js";
import { withTimeout } from "./services/async-guard.js";
import {
  auraMedicalConversationTurnService,
} from "./services/kimi-runtime.js";
import { logServerDebug } from "./lib/debug.js";
import { env } from "./lib/env.js";
import { vaultV2Service } from "./services/vault-v2-service.js";

export const app = new Hono<{ Bindings: HttpBindings }>();
vaultV2Service.startWorker();

const CHAT_ROUTE_TIMEOUT_MS = 120_000;
const SHOULD_STREAM_PROVIDER_DIRECTLY = !env.isProduction;

function createNdjsonStreamResponse(
  run: (streamController: TurnStreamController) => Promise<void>,
  label = "Chat stream",
) {
  const encoder = new TextEncoder();
  let streamController: TurnStreamController | null = null;
  const stream = new ReadableStream({
    start(controller) {
      streamController = new TurnStreamController({
        write: payload => {
          controller.enqueue(encoder.encode(payload));
        },
        close: () => {
          controller.close();
        },
      });

      void withTimeout(run(streamController), {
        label,
        timeoutMs: CHAT_ROUTE_TIMEOUT_MS,
      }).catch(error => {
        streamController?.fail(
          error instanceof Error
            ? error.message
            : "Chat streaming failed unexpectedly.",
        );
      });
    },
    cancel() {
      streamController?.disconnect();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.post("/api/chat/stream", async (c) => {
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

  return createNdjsonStreamResponse(async streamController => {
    const requestId = globalThis.crypto.randomUUID().slice(0, 8);
    logServerDebug("chat.turn.route.start", {
      requestId,
      route: "/api/chat/stream",
      conversationId: parsed.data.conversationId,
      agentId: parsed.data.agentId,
      userId: user.id,
    });
    const result = await auraMedicalConversationTurnService.executeTurn({
      input: {
        ...parsed.data,
        runtimeVersion: "aura-medical-v1",
        medicalMode: parsed.data.medicalMode ?? "personal-health",
        policyLevel: parsed.data.policyLevel ?? "interpretive-on-request",
      },
      userId: user.id,
      streamPrimary: SHOULD_STREAM_PROVIDER_DIRECTLY,
      traceContext: {
        requestId,
        route: "/api/chat/stream",
      },
      onStage: async stage => {
        streamController.emitStage(stage);
      },
      onTextDelta: async delta => {
        streamController.emitDelta(delta);
      },
    });

    if (result.assistantMessage) {
      streamController.complete({
        id: String(result.assistantMessage.id),
        role: "assistant",
        content: result.assistantMessage.content,
        agentId: result.assistantMessage.agentId,
        createdAt: result.assistantMessage.createdAt.toISOString(),
        metadata: result.assistantMessage.metadata,
      });
      return;
    }

    streamController.fail(
      "Chat turn finished without a persisted assistant message.",
    );
  }, "Unified Aura chat turn");
});
app.post("/api/kimi/chat/stream", async (c) => {
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
      400,
    );
  }

  return createNdjsonStreamResponse(async streamController => {
    const requestId = globalThis.crypto.randomUUID().slice(0, 8);
    logServerDebug("chat.turn.route.start", {
      requestId,
      route: "/api/kimi/chat/stream",
      conversationId: parsed.data.conversationId,
      agentId: parsed.data.agentId,
      userId: user.id,
    });
    const result = await auraMedicalConversationTurnService.executeTurn({
      input: {
        ...parsed.data,
        runtimeVersion: "aura-medical-v1",
        medicalMode: parsed.data.medicalMode ?? "personal-health",
        policyLevel: parsed.data.policyLevel ?? "interpretive-on-request",
      },
      userId: user.id,
      streamPrimary: SHOULD_STREAM_PROVIDER_DIRECTLY,
      traceContext: {
        requestId,
      route: "/api/kimi/chat/stream",
      },
      onStage: async stage => {
        streamController.emitStage(stage);
      },
      onTextDelta: async delta => {
        streamController.emitDelta(delta);
      },
    });

    if (!result.assistantMessage) {
      streamController.fail(
        "Unified Aura runtime finished without a persisted assistant message.",
      );
      return;
    }

    streamController.complete({
      id: String(result.assistantMessage.id),
      role: "assistant",
      content: result.assistantMessage.content,
      agentId: result.assistantMessage.agentId,
      createdAt: result.assistantMessage.createdAt.toISOString(),
      metadata: result.assistantMessage.metadata,
    });
  }, "Unified Kimi alias chat turn");
});
app.post("/api/aura-medical/chat/stream", async (c) => {
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
      400,
    );
  }

  return createNdjsonStreamResponse(async streamController => {
    const requestId = globalThis.crypto.randomUUID().slice(0, 8);
    logServerDebug("chat.turn.route.start", {
      requestId,
      route: "/api/aura-medical/chat/stream",
      conversationId: parsed.data.conversationId,
      agentId: parsed.data.agentId,
      userId: user.id,
      medicalMode: parsed.data.medicalMode ?? "personal-health",
    });
    const result = await auraMedicalConversationTurnService.executeTurn({
      input: {
        ...parsed.data,
        runtimeVersion: "aura-medical-v1",
      },
      userId: user.id,
      streamPrimary: SHOULD_STREAM_PROVIDER_DIRECTLY,
      traceContext: {
        requestId,
        route: "/api/aura-medical/chat/stream",
      },
      onStage: async stage => {
        streamController.emitStage(stage);
      },
      onTextDelta: async delta => {
        streamController.emitDelta(delta);
      },
    });

    if (!result.assistantMessage) {
      streamController.fail(
        "Aura Medical Runtime V1 finished without a persisted assistant message.",
      );
      return;
    }

    streamController.complete({
      id: String(result.assistantMessage.id),
      role: "assistant",
      content: result.assistantMessage.content,
      agentId: result.assistantMessage.agentId,
      createdAt: result.assistantMessage.createdAt.toISOString(),
      metadata: result.assistantMessage.metadata,
    });
  }, "Aura Medical chat turn");
});
app.post("/api/vault/documents", async c => {
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
            : "Kimi vault upload failed unexpectedly.",
      },
      500,
    );
  }
});
app.get("/api/vault/documents", async c => {
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
      500,
    );
  }
});
app.get("/api/vault/documents/:id", async c => {
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
      404,
    );
  }
});
app.get("/api/vault/documents/:id/events", async c => {
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
      404,
    );
  }
});
app.get("/api/vault/documents/:id/original", async c => {
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
    const original = await vaultV2Service.readDocumentOriginal(user.id, documentId);

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
      404,
    );
  }
});
app.post("/api/vault/documents/:id/reprocess", async c => {
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
      404,
    );
  }
});
app.post("/api/vault/documents/:id/reclassify", async c => {
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
      404,
    );
  }
});
app.delete("/api/vault/documents/:id", async c => {
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
      404,
    );
  }
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

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

import { stream } from "hono/streaming";
import type { Context, Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { classifyApiError } from "../lib/api-errors.js";
import { logServerDebug } from "../lib/debug.js";
import { withAbortableTimeout } from "../services/async-guard.js";
import { TurnStreamController } from "../services/turn-stream-controller.js";
import { auraChatConversationTurnRuntime } from "../services/venice-chat-runtime.js";
import { authenticateRequest } from "../trpc/auth.js";
import { chatSendMessageInputSchema } from "../trpc/chat-router.js";
import { handleDiagnoseTurnRequest } from "./diagnose-turn-handler.js";
import { handleProviderCheckRequest } from "./provider-check-handler.js";
import { handleSimpleChatRequest } from "./simple-chat-handler.js";

type App = Hono<{ Bindings: HttpBindings }>;
type HonoContext = Context<{ Bindings: HttpBindings }>;

const CHAT_ROUTE_TIMEOUT_MS = 180_000;
const SHOULD_STREAM_PROVIDER_DIRECTLY = true;

export function shouldStreamProviderDirectlyInRoutes() {
  return SHOULD_STREAM_PROVIDER_DIRECTLY;
}

function createNdjsonStreamResponse(
  c: HonoContext,
  run: (
    streamController: TurnStreamController,
    signal: AbortSignal,
  ) => Promise<void>,
  details: {
    requestId: string;
    route: string;
    conversationId: number;
    userId: number;
    agentId: string;
  },
  label = "Chat stream",
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
          new Error("Client disconnected while streaming chat."),
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
          },
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
        })}\n`,
      );
    },
  );
}

async function handleChatStreamRoute(c: HonoContext) {
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
      400,
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

      await streamController.complete({
        id: String(result.assistantMessage.id),
        role: "assistant",
        content: result.assistantMessage.content,
        agentId: result.assistantMessage.agentId,
        createdAt: result.assistantMessage.createdAt.toISOString(),
        metadata: result.assistantMessage.metadata,
      });
    },
    {
      requestId,
      route,
      conversationId: parsed.data.conversationId,
      userId: user.id,
      agentId: parsed.data.agentId,
    },
    "Aura chat turn",
  );
}

export function registerChatRoutes(app: App) {
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
}

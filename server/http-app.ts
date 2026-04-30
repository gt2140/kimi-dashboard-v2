import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { authenticateRequest } from "./trpc/auth.js";
import {
  chatSendMessageInputSchema,
  sendChatMessage,
} from "./trpc/chat-router.js";
import { encodeChatStreamEvent } from "../src/lib/chat-stream.js";

export const app = new Hono<{ Bindings: HttpBindings }>();
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const writeEvent = (payload: string) => {
        controller.enqueue(encoder.encode(payload));
      };

      void (async () => {
        try {
          const result = await sendChatMessage({
            input: parsed.data,
            userId: user.id,
            streamPrimary: true,
            onStage: async (stage) => {
              writeEvent(
                encodeChatStreamEvent({
                  type: "stage",
                  stageId: stage.id,
                  label: stage.label,
                })
              );
            },
            onTextDelta: async (delta) => {
              writeEvent(
                encodeChatStreamEvent({
                  type: "text-delta",
                  delta,
                })
              );
            },
          });

          if (result.assistantMessage) {
            writeEvent(
              encodeChatStreamEvent({
                type: "message-complete",
                message: {
                  id: String(result.assistantMessage.id),
                  role: "assistant",
                  content: result.assistantMessage.content,
                  agentId: result.assistantMessage.agentId,
                  createdAt: result.assistantMessage.createdAt.toISOString(),
                  metadata: result.assistantMessage.metadata,
                },
              })
            );
          }
        } catch (error) {
          writeEvent(
            encodeChatStreamEvent({
              type: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Chat streaming failed unexpectedly.",
            })
          );
        } finally {
          controller.close();
        }
      })();
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
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

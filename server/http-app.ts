import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { authenticateRequest } from "./trpc/auth.js";
import { requestKimiChatCompletion } from "./services/kimi-chat-client.js";

export const app = new Hono<{ Bindings: HttpBindings }>();
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.post("/api/kimi/chat", async c => {
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as
    | {
        agentId?: string;
        content?: string;
        systemPrompt?: string;
      }
    | null;

  if (
    !body ||
    typeof body.agentId !== "string" ||
    typeof body.content !== "string" ||
    typeof body.systemPrompt !== "string" ||
    !body.content.trim()
  ) {
    return c.json({ error: "Invalid request body." }, 400);
  }

  try {
    const reply = await requestKimiChatCompletion({
      systemPrompt: body.systemPrompt,
      message: body.content.trim(),
      userId: user.id,
    });

    return c.json({
      message: {
        content: reply.content,
        metadata: {
          providerSlug: "kimi",
          modelName: reply.model,
          note: "simple-kimi-chat",
          responseMode: "model",
          inputTokens: reply.usage.inputTokens,
          outputTokens: reply.usage.outputTokens,
        },
      },
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Kimi request failed unexpectedly.",
      },
      500,
    );
  }
});
app.get("/api/health", c => c.json({ ok: true }));
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

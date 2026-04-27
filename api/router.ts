import { authRouter } from "./auth-router";
import { agentsRouter } from "./agents-router";
import { chatRouter } from "./chat-router";
import { vaultRouter } from "./vault-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  agents: agentsRouter,
  chat: chatRouter,
  vault: vaultRouter,
});

export type AppRouter = typeof appRouter;

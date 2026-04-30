import { authRouter } from "./auth-router.js";
import { agentsRouter } from "./agents-router.js";
import { chatRouter } from "./chat-router.js";
import { vaultRouter } from "./vault-router.js";
import { createRouter, publicQuery } from "./middleware.js";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  agents: agentsRouter,
  chat: chatRouter,
  vault: vaultRouter,
});

export type AppRouter = typeof appRouter;

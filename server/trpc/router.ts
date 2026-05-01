import { authRouter } from "./auth-router.js";
import { chatRouter } from "./chat-router.js";
import { vaultRouter } from "./vault-router.js";
import { createRouter, publicQuery } from "./middleware.js";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  chat: chatRouter,
  vault: vaultRouter,
});

export type AppRouter = typeof appRouter;

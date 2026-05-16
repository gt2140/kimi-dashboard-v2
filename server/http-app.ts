import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { registerChatRoutes } from "./chat/chat-routes.js";
import { registerVaultRoutes } from "./vault/vault-routes.js";

export { shouldStreamProviderDirectlyInRoutes } from "./chat/chat-routes.js";

export const app = new Hono<{ Bindings: HttpBindings }>();

app.use("/api/trpc/*", async c => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

registerChatRoutes(app);
registerVaultRoutes(app);
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));

export default app;

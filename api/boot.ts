import { app } from "../server/http-app.js";
import { env } from "../server/lib/env.js";

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("../server/lib/vite.js");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
export default app;

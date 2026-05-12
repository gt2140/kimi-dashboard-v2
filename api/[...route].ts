import { handle } from "@hono/node-server/vercel";
import { app } from "../server/http-app.js";
import { wrapVercelJsonHandler } from "../server/lib/vercel-error-boundary.js";

export default wrapVercelJsonHandler(handle(app));

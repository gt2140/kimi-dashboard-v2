import { handle } from "@hono/node-server/vercel";
import { app } from "../../../server/http-app.js";
import { wrapVercelNdjsonHandler } from "../../../server/lib/vercel-error-boundary.js";

export default wrapVercelNdjsonHandler(handle(app));

import { handle } from "@hono/node-server/vercel";
import { app } from "../server/http-app.js";

export default handle(app);

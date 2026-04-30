import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../db/schema.js";
import { authenticateRequest } from "./auth.js";
import { logServerDebug, logServerError } from "../lib/debug.js";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
    logServerDebug("context.user.resolved", {
      path: new URL(opts.req.url).pathname,
      userId: ctx.user.id,
      unionId: ctx.user.unionId,
    });
  } catch {
    logServerError("context.user.missing", "unauthenticated", {
      path: new URL(opts.req.url).pathname,
      hasCookieHeader: opts.req.headers.has("cookie"),
      hasAuthorizationHeader: opts.req.headers.has("authorization"),
    });
    // Authentication is optional here
  }
  return ctx;
}

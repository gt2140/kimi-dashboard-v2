import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { Session } from "../../contracts/constants.js";
import { createAppSessionFromSupabaseToken } from "./auth.js";
import { logServerDebug, logServerError } from "../lib/debug.js";
import { getSessionCookieOptions } from "../lib/cookies.js";
import { env } from "../lib/env.js";
import { createRouter, authedQuery, publicQuery } from "./middleware.js";
import {
  getDatabaseSetupState,
  checkDatabaseHealth,
} from "../queries/connection.js";
import { z } from "zod";

export const authRouter = createRouter({
  status: publicQuery.query(async ({ ctx }) => {
    const dbHealth = await checkDatabaseHealth();
    return {
      app: {
        sessionSecretConfigured: Boolean(env.appSecret),
        supabaseUrlConfigured: Boolean(env.supabaseUrl),
        supabaseAnonKeyConfigured: Boolean(env.supabaseAnonKey),
        databaseConfigured: getDatabaseSetupState().ok,
      },
      db: dbHealth,
      auth: {
        hasAuthorizationHeader: ctx.req.headers.has("authorization"),
        hasCookieHeader: ctx.req.headers.has("cookie"),
        resolvedUser: ctx.user
          ? {
              id: ctx.user.id,
              unionId: ctx.user.unionId,
              email: ctx.user.email,
            }
          : null,
      },
    };
  }),
  debug: publicQuery.query(({ ctx }) => ({
    hasAuthorizationHeader: ctx.req.headers.has("authorization"),
    authorizationPrefix:
      ctx.req.headers.get("authorization")?.slice(0, 16) ?? null,
    hasCookieHeader: ctx.req.headers.has("cookie"),
    supabaseUrlConfigured: Boolean(env.supabaseUrl),
    supabaseAnonKeyConfigured: Boolean(env.supabaseAnonKey),
    resolvedUser: ctx.user
      ? {
          id: ctx.user.id,
          unionId: ctx.user.unionId,
          email: ctx.user.email,
        }
      : null,
  })),
  syncSession: publicQuery
    .input(z.object({ accessToken: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      logServerDebug("auth.syncSession.start", {
        hasAuthorizationHeader: ctx.req.headers.has("authorization"),
        hasCookieHeader: ctx.req.headers.has("cookie"),
      });
      try {
        if (!env.appSecret) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Backend setup error: SESSION_SECRET is missing.",
          });
        }

        const sessionCookie = await createAppSessionFromSupabaseToken(
          input.accessToken,
          ctx.req.headers
        );
        ctx.resHeaders.append("set-cookie", sessionCookie);
        logServerDebug("auth.syncSession.success", {
          dbHost: getDatabaseSetupState().host,
        });
        return { success: true, dbHost: getDatabaseSetupState().host };
      } catch (error) {
        logServerError("auth.syncSession.failed", error);
        throw error;
      }
    }),
  me: authedQuery.query(opts => {
    logServerDebug("auth.me", {
      userId: opts.ctx.user.id,
      unionId: opts.ctx.user.unionId,
    });
    return opts.ctx.user;
  }),
  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    logServerDebug("auth.logout", {
      userId: ctx.user.id,
      unionId: ctx.user.unionId,
    });
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      })
    );
    return { success: true };
  }),
});

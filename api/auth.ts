import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { Errors } from "@contracts/errors";
import { env } from "./lib/env";
import { logServerDebug, logServerError } from "./lib/debug";
import { signSessionToken } from "./kimi/session";
import { verifySessionToken } from "./kimi/session";
import { findUserByUnionId, upsertUser } from "./queries/users";
import { getSessionCookieOptions } from "./lib/cookies";

type SupabaseUserPayload = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

function getSupabaseUrl() {
  if (!env.supabaseUrl) {
    throw new Error(
      "SUPABASE_URL is missing. Set it in your .env file to enable Supabase Auth."
    );
  }

  return env.supabaseUrl;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getProfileName(payload: SupabaseUserPayload) {
  const metadata = payload.user_metadata ?? {};
  return (
    pickString(metadata.full_name) ??
    pickString(metadata.name) ??
    pickString(metadata.user_name) ??
    pickString(payload.email)?.split("@")[0]
  );
}

function getProfileAvatar(payload: SupabaseUserPayload) {
  const metadata = payload.user_metadata ?? {};
  return pickString(metadata.avatar_url) ?? pickString(metadata.picture);
}

function getBearerToken(headers: Headers) {
  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

export async function authenticateSupabaseAccessToken(accessToken: string) {
  if (!accessToken) {
    throw Errors.forbidden("Invalid authentication token.");
  }

  logServerDebug("auth.supabase-token.validate.start");

  const response = await fetch(`${getSupabaseUrl()}/auth/v1/user`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      apikey: env.supabaseAnonKey,
    },
  });

  if (!response.ok) {
    logServerError("auth.supabase-token.validate.failed", response.status);
    throw Errors.forbidden("Invalid authentication token.");
  }

  const supabasePayload = (await response.json()) as SupabaseUserPayload;
  const subject = pickString(supabasePayload.id);
  if (!subject) {
    throw Errors.forbidden("Invalid authentication token.");
  }

  const unionId = `supabase:${subject}`;
  await upsertUser({
    unionId,
    email: pickString(supabasePayload.email),
    name: getProfileName(supabasePayload),
    avatar: getProfileAvatar(supabasePayload),
    lastSignInAt: new Date(),
  });

  const user = await findUserByUnionId(unionId);
  if (!user) {
    throw Errors.forbidden("User not found. Please re-login.");
  }

  logServerDebug("auth.supabase-token.validate.success", {
    userId: user.id,
    unionId: user.unionId,
  });

  return user;
}

async function authenticateSupabaseToken(headers: Headers) {
  const accessToken = getBearerToken(headers);
  if (!accessToken) {
    return null;
  }

  return authenticateSupabaseAccessToken(accessToken);
}

async function authenticateLegacyCookie(headers: Headers) {
  const cookies = cookie.parse(headers.get("cookie") || "");
  const token = cookies[Session.cookieName];
  if (!token) {
    return null;
  }

  const claim = await verifySessionToken(token);
  if (!claim) {
    throw Errors.forbidden("Invalid authentication token.");
  }

  const user = await findUserByUnionId(claim.unionId);
  if (!user) {
    throw Errors.forbidden("User not found. Please re-login.");
  }

  return user;
}

export async function authenticateRequest(headers: Headers) {
  if (env.supabaseUrl) {
    const supabaseUser = await authenticateSupabaseToken(headers);
    if (supabaseUser) {
      logServerDebug("auth.request.resolved", {
        source: "supabase-bearer",
        userId: supabaseUser.id,
        unionId: supabaseUser.unionId,
      });
      return supabaseUser;
    }
  }

  const legacyUser = await authenticateLegacyCookie(headers);
  if (legacyUser) {
    logServerDebug("auth.request.resolved", {
      source: "session-cookie",
      userId: legacyUser.id,
      unionId: legacyUser.unionId,
    });
    return legacyUser;
  }

  logServerError("auth.request.failed", "no-valid-auth", {
    hasCookieHeader: headers.has("cookie"),
    hasAuthorizationHeader: headers.has("authorization"),
  });
  throw Errors.forbidden("Invalid authentication token.");
}

export async function createAppSessionFromSupabaseToken(
  accessToken: string,
  headers: Headers
) {
  const user = await authenticateSupabaseAccessToken(accessToken);
  const token = await signSessionToken({
    unionId: user.unionId,
    clientId: env.appId,
  });
  const opts = getSessionCookieOptions(headers);
  logServerDebug("auth.session-cookie.create", {
    userId: user.id,
    unionId: user.unionId,
    secure: opts.secure,
    sameSite: opts.sameSite,
  });

  return cookie.serialize(Session.cookieName, token, {
    httpOnly: opts.httpOnly,
    path: opts.path,
    sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
    secure: opts.secure,
    maxAge: Session.maxAgeMs / 1000,
  });
}

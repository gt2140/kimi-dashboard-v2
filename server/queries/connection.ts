import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env.js";
import * as schema from "../../db/schema.js";
import * as relations from "../../db/relations.js";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;
let client: postgres.Sql | undefined;
let lastHealthCheck:
  | {
      checkedAt: number;
      ok: boolean;
      message: string;
    }
  | undefined;

function readConnectionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const candidate = error as Error & {
      cause?: unknown;
      code?: string;
    };

    const cause = candidate.cause;
    if (cause && typeof cause === "object") {
      const causeRecord = cause as {
        message?: string;
        code?: string;
        hostname?: string;
      };

      if (causeRecord.code === "ENOTFOUND" && causeRecord.hostname) {
        return `Could not resolve database host ${causeRecord.hostname}. If you are using the direct Supabase DB host, switch DATABASE_URL to the Supabase pooled connection string.`;
      }

      if (typeof causeRecord.message === "string" && causeRecord.message.trim()) {
        return causeRecord.message.trim();
      }
    }

    if (candidate.code === "ENOTFOUND") {
      return "Could not resolve the configured database host.";
    }

    const normalizedMessage = candidate.message.toLowerCase();
    if (
      candidate.code === "EMAXCONNSESSION" ||
      normalizedMessage.includes("emaxconnsession") ||
      normalizedMessage.includes("max clients reached in session mode")
    ) {
      return "Supabase pooled Postgres rejected the connection because too many session-mode clients were opened. Use the pooled DATABASE_URL on port 6543, keep the backend pool small, and restart the backend so it drops stale direct connections.";
    }

    if (candidate.message.trim()) {
      return candidate.message.trim();
    }
  }

  return "Database connection failed unexpectedly.";
}

function getConfiguredDatabaseHost() {
  if (!env.databaseUrl) {
    return null;
  }

  try {
    return new URL(env.databaseUrl).host;
  } catch {
    return null;
  }
}

export function getDb() {
  if (!instance) {
    client = postgres(env.databaseUrl, {
      prepare: false,
      ssl: "require",
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    instance = drizzle(client, { schema: fullSchema });
  }
  return instance;
}

export function getDatabaseSetupState() {
  if (!env.databaseUrl) {
    return {
      ok: false,
      code: "missing-database-url",
      message:
        "DATABASE_URL is missing. Add a valid Supabase Postgres connection string.",
      host: null,
    } as const;
  }

  try {
    const url = new URL(env.databaseUrl);
    return {
      ok: true,
      code: "configured",
      message: "Database URL is configured.",
      host: url.host,
    } as const;
  } catch {
    return {
      ok: false,
      code: "invalid-database-url",
      message:
        "DATABASE_URL is invalid. Use the exact Postgres connection string from Supabase.",
      host: null,
    } as const;
  }
}

export async function checkDatabaseHealth(force = false) {
  const setup = getDatabaseSetupState();
  if (!setup.ok) {
    return {
      ok: false,
      code: setup.code,
      message: setup.message,
      host: setup.host,
      checkedAt: new Date().toISOString(),
    } as const;
  }

  if (
    !force &&
    lastHealthCheck &&
    Date.now() - lastHealthCheck.checkedAt < 15_000
  ) {
    return {
      ok: lastHealthCheck.ok,
      code: lastHealthCheck.ok ? "ok" : "unreachable",
      message: lastHealthCheck.message,
      host: getConfiguredDatabaseHost(),
      checkedAt: new Date(lastHealthCheck.checkedAt).toISOString(),
    } as const;
  }

  try {
    await getDb().execute(sql`select 1`);
    lastHealthCheck = {
      checkedAt: Date.now(),
      ok: true,
      message: "Database connection is healthy.",
    };
    return {
      ok: true,
      code: "ok",
      message: lastHealthCheck.message,
      host: getConfiguredDatabaseHost(),
      checkedAt: new Date(lastHealthCheck.checkedAt).toISOString(),
    } as const;
  } catch (error) {
    const message = readConnectionErrorMessage(error);
    lastHealthCheck = {
      checkedAt: Date.now(),
      ok: false,
      message,
    };
    return {
      ok: false,
      code: "unreachable",
      message,
      host: getConfiguredDatabaseHost(),
      checkedAt: new Date(lastHealthCheck.checkedAt).toISOString(),
    } as const;
  }
}

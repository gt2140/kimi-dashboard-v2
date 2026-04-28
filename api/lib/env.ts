import path from "path";
import { config as loadEnv } from "dotenv";

loadEnv({
  path: path.resolve(import.meta.dirname, "../../.env"),
});

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function optionalUrl(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return "";
  }

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid URL in environment variable ${name}: ${value}`);
  }
}

function requiredOneOf(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `Missing required environment variable. Expected one of: ${names.join(", ")}`,
    );
  }

  return "";
}

export const env = {
  appId: process.env.APP_ID?.trim() || "supabase",
  appSecret: requiredOneOf("SESSION_SECRET", "APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  kimiAuthUrl: optionalUrl("KIMI_AUTH_URL"),
  kimiOpenUrl: optionalUrl("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  supabaseUrl: optionalUrl("SUPABASE_URL"),
  supabaseAnonKey: requiredOneOf("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"),
};

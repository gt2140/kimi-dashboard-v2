import path from "path";
import { config as loadEnv } from "dotenv";

loadEnv({
  path: path.resolve(import.meta.dirname, "../../.env"),
});

function required(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function optionalUrl(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (!value) {
      continue;
    }

    try {
      return new URL(value).toString().replace(/\/$/, "");
    } catch {
      throw new Error(`Invalid URL in environment variable ${name}: ${value}`);
    }
  }

  return "";
}

function requiredOneOf(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
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
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || "",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY?.trim() || "",
  kimiApiKey: process.env.KIMI_API_KEY?.trim() || "",
  supabaseUrl: optionalUrl("SUPABASE_URL", "VITE_SUPABASE_URL"),
  supabaseAnonKey: requiredOneOf("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"),
};

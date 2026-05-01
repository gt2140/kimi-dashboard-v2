import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

async function loadEnvModule() {
  vi.resetModules();
  vi.doMock("dotenv", () => ({
    config: () => ({}),
  }));
  return import("../server/lib/env.ts");
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  vi.doUnmock("dotenv");
  process.env = { ...ORIGINAL_ENV };
});

describe("server env resolution", () => {
  it("does not throw during import when production secrets are missing", async () => {
    process.env = {
      NODE_ENV: "production",
    };

    const { env } = await loadEnvModule();

    expect(env.appSecret).toBe("");
    expect(env.databaseUrl).toBe("");
    expect(env.supabaseUrl).toBe("");
  });

  it("falls back to the public Supabase URL for backend validation", async () => {
    process.env = {
      NODE_ENV: "production",
      VITE_SUPABASE_URL: "https://example.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "public-anon-key",
    };

    const { env } = await loadEnvModule();

    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.supabaseAnonKey).toBe("public-anon-key");
  });
});

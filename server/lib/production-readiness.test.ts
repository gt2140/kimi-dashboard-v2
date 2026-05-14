import { describe, expect, it } from "vitest";
import { buildProductionReadinessPayload } from "./production-readiness.js";

describe("buildProductionReadinessPayload", () => {
  it("reports the production chat dependencies without exposing secrets", () => {
    const payload = buildProductionReadinessPayload({
      appSecret: "session-secret",
      databaseUrl: "postgresql://user:password@example.supabase.com/postgres",
      supabaseUrl: "https://project.supabase.co",
      supabaseAnonKey: "public-anon-key",
      veniceApiKey: "venice-secret",
      veniceModel: "zai-org-glm-5",
    });

    expect(payload).toEqual({
      ok: true,
      service: "aura-dashboard",
      chatProvider: "venice",
      defaultModel: "zai-org-glm-5",
      checks: {
        sessionSecret: true,
        database: true,
        supabaseUrl: true,
        supabaseAnonKey: true,
        veniceKey: true,
        veniceModel: true,
      },
      missing: [],
    });
    expect(JSON.stringify(payload)).not.toContain("session-secret");
    expect(JSON.stringify(payload)).not.toContain("password");
    expect(JSON.stringify(payload)).not.toContain("venice-secret");
  });

  it("lists missing production dependencies for Vercel smoke checks", () => {
    const payload = buildProductionReadinessPayload({
      appSecret: "",
      databaseUrl: "",
      supabaseUrl: "https://project.supabase.co",
      supabaseAnonKey: "",
      veniceApiKey: "",
      veniceModel: "",
    });

    expect(payload.ok).toBe(false);
    expect(payload.missing).toEqual([
      "SESSION_SECRET",
      "DATABASE_URL",
      "SUPABASE_ANON_KEY",
      "VENICE_API_KEY_OR_VENICE_INFERENCE_KEY",
      "VENICE_MODEL",
    ]);
  });
});

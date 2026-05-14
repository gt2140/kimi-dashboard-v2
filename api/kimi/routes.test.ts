import { describe, expect, it } from "vitest";

describe("Canonical Vercel route handlers", () => {
  it("exposes the catch-all API handler used by Vault V2", async () => {
    const mod = await import("../[...route].ts");
    expect(typeof mod.default).toBe("function");
  }, 15_000);

  it("exposes the canonical chat stream handler", async () => {
    const mod = await import("../chat/stream.ts");
    expect(typeof mod.default).toBe("function");
  });
});

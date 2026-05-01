import { describe, expect, it } from "vitest";

describe("Kimi Vercel route handlers", () => {
  it("exposes the minimal kimi chat handler", async () => {
    const mod = await import("./chat.ts");
    expect(typeof mod.default).toBe("function");
  });
});

import { describe, expect, it } from "vitest";

describe("Kimi Vercel route handlers", () => {
  it("exposes the Kimi chat respond handler", async () => {
    const mod = await import("./chat/respond.ts");
    expect(typeof mod.default).toBe("function");
  });

  it("exposes the Kimi vault upload handler", async () => {
    const mod = await import("./vault/upload.ts");
    expect(typeof mod.default).toBe("function");
  });

  it("exposes the Kimi vault file preview handler", async () => {
    const mod = await import("./vault/file/[id].ts");
    expect(typeof mod.default).toBe("function");
  });
});

import { describe, expect, it, vi } from "vitest";
import { buildAuthenticatedHeaders } from "./request-auth";

describe("buildAuthenticatedHeaders", () => {
  it("adds the current bearer token when one is available", async () => {
    const headers = await buildAuthenticatedHeaders(
      vi.fn().mockResolvedValue("token-123"),
      { "content-type": "application/json" }
    );

    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("authorization")).toBe("Bearer token-123");
  });

  it("keeps an existing authorization header untouched", async () => {
    const headers = await buildAuthenticatedHeaders(
      vi.fn().mockResolvedValue("token-123"),
      { authorization: "Bearer existing-token" }
    );

    expect(headers.get("authorization")).toBe("Bearer existing-token");
  });

  it("returns the provided headers unchanged when no token exists", async () => {
    const headers = await buildAuthenticatedHeaders(
      vi.fn().mockResolvedValue(null),
      { "x-trace-id": "abc" }
    );

    expect(headers.get("x-trace-id")).toBe("abc");
    expect(headers.has("authorization")).toBe(false);
  });
});

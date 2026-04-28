import { describe, expect, it } from "vitest";
import { formatRuntimeError } from "./app-errors";

describe("formatRuntimeError", () => {
  it("normalizes unauthorized errors", () => {
    expect(
      formatRuntimeError({
        message: "Authentication required",
        data: { code: "UNAUTHORIZED" },
      })
    ).toBe("Auth error: sign in again to continue.");
  });

  it("normalizes setup and database style failures", () => {
    expect(
      formatRuntimeError(new Error("Database connection failed"), "Auth")
    ).toBe("Database error: Database connection failed");
  });
});

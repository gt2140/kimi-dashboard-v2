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

  it("normalizes raw abort errors into a readable retry message", () => {
    expect(
      formatRuntimeError(new Error("This operation was aborted"), "Chat")
    ).toBe("Network error: the request was interrupted. Try again.");
  });

  it("normalizes auth provider timeouts into retry guidance", () => {
    expect(
      formatRuntimeError(
        new Error("Authentication provider took too long to validate the session."),
        "Auth"
      )
    ).toBe("Auth error: Google sign-in took too long to finish. Try again.");
  });

  it("normalizes backend session sync stalls into a wait-and-retry message", () => {
    expect(
      formatRuntimeError(
        new Error("Your browser session exists, but the backend session is not ready yet."),
        "Auth"
      )
    ).toBe("Auth error: sign-in is still finishing in the background. Try again in a moment.");
  });
});

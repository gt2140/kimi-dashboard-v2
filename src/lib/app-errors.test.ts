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
    expect(
      formatRuntimeError(new Error("BodyStreamBuffer was aborted"), "Chat")
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

  it("surfaces backend chat turn timeouts as runtime failures instead of generic network errors", () => {
    expect(
      formatRuntimeError(
        new Error("Aura Medical chat turn timed out after 45000ms."),
        "Aura chat"
      )
    ).toBe(
      "Runtime error: the chat backend timed out before finishing. Check the deployed API, database connectivity, or model provider."
    );
  });

  it("surfaces production stream startup timeouts as backend timeouts", () => {
    expect(
      formatRuntimeError(
        new Error("Aura chat stream timed out after 60000ms."),
        "Aura chat"
      )
    ).toBe(
      "Backend timeout: the chat backend took too long to start streaming. Check the deployed API, auth, database connectivity, or cold start logs."
    );
  });

  it("surfaces provider failures as runtime errors instead of generic network failures", () => {
    expect(
      formatRuntimeError(
        new Error("Kimi request failed (502): upstream error"),
        "Aura chat"
      )
    ).toBe(
      "Runtime error: the model provider failed to complete the chat turn. Check the local API logs for provider or stream details."
    );
  });

  it("preserves sanitized Venice provider details", () => {
    expect(
      formatRuntimeError(
        {
          message:
            "Venice request failed (404). The selected model is unavailable.",
          category: "provider-error",
          traceId: "venice-1",
        },
        "Aura chat"
      )
    ).toBe(
      "Provider error: Venice request failed (404). The selected model is unavailable. (trace venice-1)"
    );
  });

  it("prefers structured provider diagnostics over a generic provider message", () => {
    expect(
      formatRuntimeError(
        {
          message:
            "the model provider failed to complete the chat turn",
          category: "provider-error",
          traceId: "venice-2",
          provider: {
            message:
              "Venice request failed (401). Check VENICE_API_KEY or VENICE_INFERENCE_KEY.",
          },
        },
        "Aura chat"
      )
    ).toBe(
      "Provider error: Venice request failed (401). Check VENICE_API_KEY or VENICE_INFERENCE_KEY. (trace venice-2)"
    );
  });

  it("formats structured provider timeout errors with trace ids", () => {
    expect(
      formatRuntimeError({
        message: "Primary response generation timed out after 25000ms.",
        category: "provider-timeout",
        traceId: "trace-456",
      }, "Aura chat")
    ).toBe(
      "Provider timeout: the model provider took too long to answer. Retry in a moment. (trace trace-456)"
    );
  });

  it("formats structured backend timeout errors with trace ids", () => {
    expect(
      formatRuntimeError({
        message: "Aura Medical chat turn timed out after 180000ms.",
        category: "backend-timeout",
        traceId: "trace-999",
      }, "Aura chat")
    ).toBe(
      "Backend timeout: the chat backend took too long to finish. Check the deployed API, database connectivity, or upstream provider. (trace trace-999)"
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  classifyApiError,
  toJsonErrorResponse,
  toNdjsonErrorEvent,
} from "./api-errors.js";

describe("api-errors", () => {
  it("classifies provider timeouts", () => {
    expect(
      classifyApiError(
        new Error("Primary response generation timed out after 25000ms."),
      ),
    ).toEqual(
      expect.objectContaining({
        category: "provider-timeout",
      }),
    );
  });

  it("classifies plain Vercel runtime errors as backend timeouts", () => {
    expect(classifyApiError(new Error("An error occurred"))).toEqual(
      expect.objectContaining({
        category: "backend-timeout",
      }),
    );
  });

  it("classifies database schema and relation failures", () => {
    expect(
      classifyApiError(new Error('relation "messages" does not exist')),
    ).toEqual(
      expect.objectContaining({
        category: "db-error",
      }),
    );
  });

  it("serializes JSON errors with a stable shape", async () => {
    const response = toJsonErrorResponse(
      new Error("An error occurred"),
      500,
      "trace-json",
    );
    const payload = await response.json();

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-trace-id")).toBe("trace-json");
    expect(payload).toEqual({
      error: {
        message: "An error occurred",
        category: "backend-timeout",
        traceId: "trace-json",
      },
    });
  });

  it("serializes stream errors as one NDJSON event", () => {
    expect(toNdjsonErrorEvent(new Error("An error occurred"), "trace-stream")).toBe(
      '{"type":"error","message":"An error occurred","category":"backend-timeout","traceId":"trace-stream"}\n',
    );
  });
});

import { describe, expect, it } from "vitest";
import { normalizeTrpcHttpResponse } from "./trpc-client";

describe("normalizeTrpcHttpResponse", () => {
  it("converts non-json error responses into parseable json", async () => {
    const original = new Response("An error occurred", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-trace-id": "trace-trpc",
      },
    });

    const response = await normalizeTrpcHttpResponse(
      original,
      "http://localhost/api/trpc/chat.listConversations",
    );
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload).toEqual({
      error: {
        message: "An error occurred",
        code: "INTERNAL_SERVER_ERROR",
        data: {
          code: "INTERNAL_SERVER_ERROR",
          httpStatus: 500,
          category: "backend-timeout",
          traceId: "trace-trpc",
          bodyPreview: "An error occurred",
        },
      },
    });
  });

  it("passes json responses through unchanged", async () => {
    const original = new Response(
      JSON.stringify({ error: { message: "Already json" } }),
      {
        status: 500,
        headers: {
          "content-type": "application/json",
        },
      },
    );

    const response = await normalizeTrpcHttpResponse(original, "/api/trpc");

    expect(response).toBe(original);
  });
});

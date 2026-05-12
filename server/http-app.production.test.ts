import { beforeEach, describe, expect, it, vi } from "vitest";

describe("production chat route behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it(
    "keeps direct provider streaming enabled for serverless production routes",
    async () => {
    vi.doMock("./lib/env.js", () => ({
      env: {
        isProduction: true,
      },
    }));
    vi.doMock("./services/vault-v2-service.js", () => ({
      vaultV2Service: {
        startWorker: vi.fn(),
      },
    }));

    const { shouldStreamProviderDirectlyInRoutes } = await import("./http-app.js");

    expect(shouldStreamProviderDirectlyInRoutes()).toBe(true);
    },
    15_000,
  );

  it("returns an ndjson error event when the chat turn throws inside the stream", async () => {
    vi.doMock("./trpc/auth.js", () => ({
      authenticateRequest: vi.fn().mockResolvedValue({
        id: 42,
        unionId: "supabase:test-user",
      }),
    }));
    vi.doMock("./services/vault-v2-service.js", () => ({
      vaultV2Service: {
        startWorker: vi.fn(),
      },
    }));
    vi.doMock("./services/kimi-runtime.js", () => ({
      auraMedicalConversationTurnService: {
        executeTurn: vi
          .fn()
          .mockRejectedValue(new Error("Primary response generation timed out.")),
      },
    }));

    const { app } = await import("./http-app.js");
    const response = await app.fetch(
      new Request("http://localhost/api/aura-medical/chat/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          conversationId: 1,
          content: "hello",
          agentId: "generalist",
          calledAgentIds: [],
          runtimeVersion: "aura-medical-v1",
          medicalMode: "personal-health",
          policyLevel: "interpretive-on-request",
        }),
      }),
    );
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson",
    );
    expect(body).toContain('"type":"ack"');
    expect(body).toContain('"type":"error"');
    expect(body).toContain('"category":"provider-timeout"');
  });
});

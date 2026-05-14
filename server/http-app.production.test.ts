import { beforeEach, describe, expect, it, vi } from "vitest";

function parseNdjson(body: string) {
  return body
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line) as { type?: string; [key: string]: unknown });
}

describe("production chat route behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("./services/model-gateway.js");
  });

  it("keeps direct provider streaming enabled for serverless production routes", async () => {
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

    const { shouldStreamProviderDirectlyInRoutes } =
      await import("./http-app.js");

    expect(shouldStreamProviderDirectlyInRoutes()).toBe(true);
  }, 15_000);

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
    vi.doMock("./services/venice-chat-runtime.js", () => ({
      auraChatConversationTurnRuntime: {
        executeTurn: vi
          .fn()
          .mockRejectedValue(
            new Error("Primary response generation timed out.")
          ),
      },
    }));

    const { app } = await import("./http-app.js");
    const response = await app.fetch(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          conversationId: 1,
          content: "hello",
          agentId: "generalist",
        }),
      })
    );
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson"
    );
    expect(body).toContain('"type":"ack"');
    expect(body).toContain('"type":"error"');
    expect(body).toContain('"category":"provider-timeout"');
  });

  it("serves the json chat send route from the hono app contract", async () => {
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
    vi.doMock("./services/venice-chat-runtime.js", () => ({
      auraChatConversationTurnRuntime: {
        executeTurn: vi.fn().mockResolvedValue({
          assistantMessage: {
            id: 101,
            role: "assistant",
            content: "json send works",
            agentId: "generalist",
            createdAt: new Date("2026-05-13T12:00:00.000Z"),
            metadata: {
              engine: "aura-chat-v1",
              providerSlug: "venice",
              modelName: "zai-org-glm-5",
            },
          },
        }),
      },
    }));

    const { app } = await import("./http-app.js");
    const response = await app.fetch(
      new Request("http://localhost/api/chat/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          conversationId: 1,
          content: "hello",
          agentId: "generalist",
        }),
      })
    );

    await expect(response.json()).resolves.toMatchObject({
      message: {
        id: "101",
        content: "json send works",
      },
    });
  });

  it("serves an authenticated Venice provider diagnostic route", async () => {
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
    vi.doMock("./services/model-gateway.js", () => ({
      ModelGatewayService: class {
        async diagnoseVenice() {
          return {
            ok: true,
            providerSlug: "venice",
            modelName: "zai-org-glm-5",
            status: 200,
            category: "ready",
            message: "Venice generation is ready.",
          };
        }
      },
    }));

    const { app } = await import("./http-app.js");
    const response = await app.fetch(
      new Request("http://localhost/api/chat/provider-check", {
        headers: {
          authorization: "Bearer test-token",
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: {
        ok: true,
        providerSlug: "venice",
        category: "ready",
      },
    });
  });

  it("streams ack, stage, text delta, and completion events from the canonical chat route", async () => {
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
    vi.doMock("./services/venice-chat-runtime.js", () => ({
      auraChatConversationTurnRuntime: {
        executeTurn: vi.fn().mockImplementation(async params => {
          await params.onStage?.({
            id: "draft",
            label: "Generating the final answer",
          });
          await params.onTextDelta?.("hola");
          await params.onTextDelta?.(" mundo");

          return {
            success: true,
            assistantMessage: {
              id: 99,
              role: "assistant",
              content: "hola mundo",
              agentId: params.agentId,
              createdAt: new Date("2026-05-13T12:00:00.000Z"),
              metadata: {
                engine: "aura-multi-provider-v1",
                providerSlug: "venice",
                modelName: "zai-org-glm-5-1",
              },
            },
          };
        }),
      },
    }));

    const { app } = await import("./http-app.js");
    const response = await app.fetch(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          conversationId: 1,
          content: "hello",
          agentId: "generalist",
          requestedModelName: "zai-org-glm-5-1",
        }),
      })
    );

    const events = parseNdjson(await response.text());

    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson"
    );
    expect(events.map(event => event.type)).toEqual([
      "ack",
      "stage",
      "stage",
      "text-delta",
      "text-delta",
      "message-complete",
    ]);
    expect(events.at(-1)).toMatchObject({
      type: "message-complete",
      message: {
        id: "99",
        role: "assistant",
        content: "hola mundo",
        agentId: "generalist",
      },
    });
  });

  it("passes explicit model selection into the chat runtime", async () => {
    const executeTurn = vi.fn().mockImplementation(async params => ({
      success: true,
      assistantMessage: {
        id: 100,
        role: "assistant",
        content: "selected model response",
        agentId: params.agentId,
        createdAt: new Date("2026-05-13T12:00:00.000Z"),
        metadata: {
          engine: "aura-chat-v1",
          providerSlug: "venice",
          modelName: "zai-org-glm-5-1",
          requestedModelName: params.requestedModelName,
        },
      },
    }));

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
    vi.doMock("./services/venice-chat-runtime.js", () => ({
      auraChatConversationTurnRuntime: {
        executeTurn,
      },
    }));

    const { app } = await import("./http-app.js");
    const response = await app.fetch(
      new Request("http://localhost/api/chat/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          conversationId: 1,
          content: "use venice",
          agentId: "generalist",
          requestedModelName: "zai-org-glm-5-1",
        }),
      })
    );
    const events = parseNdjson(await response.text());

    expect(response.status).toBe(200);
    expect(executeTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        requestedModelName: "zai-org-glm-5-1",
        stream: true,
      })
    );
    expect(events.at(-1)).toMatchObject({
      type: "message-complete",
      message: {
        metadata: {
          providerSlug: "venice",
          modelName: "zai-org-glm-5-1",
          requestedModelName: "zai-org-glm-5-1",
        },
      },
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import { handleSimpleChatRequest } from "./simple-chat-handler.js";

describe("handleSimpleChatRequest", () => {
  it("returns a completed assistant message from the minimal JSON chat path", async () => {
    const executeTurn = vi.fn().mockResolvedValue({
      success: true,
      assistantMessage: {
        id: 99,
        role: "assistant",
        content: "hola desde Venice",
        agentId: "generalist",
        createdAt: new Date("2026-05-14T21:00:00.000Z"),
        metadata: {
          engine: "aura-chat-v1",
          providerSlug: "venice",
          modelName: "zai-org-glm-5",
          requestedModelName: "zai-org-glm-5",
        },
      },
    });
    const authenticate = vi.fn().mockResolvedValue({ id: 7 });
    const diagnoseProvider = vi.fn().mockResolvedValue({
      ok: true,
      providerSlug: "venice",
      modelName: "zai-org-glm-5",
      status: 200,
      category: "ready",
      message: "Venice generation is ready.",
    });

    const response = await handleSimpleChatRequest(
      new Request("https://example.com/api/chat/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          conversationId: 42,
          content: "holaaa",
          agentId: "generalist",
          requestedModelName: "zai-org-glm-5",
        }),
      }),
      {
        authenticateRequest: authenticate,
        runtime: { executeTurn },
        diagnoseProvider,
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      message: {
        id: "99",
        role: "assistant",
        content: "hola desde Venice",
        agentId: "generalist",
        createdAt: "2026-05-14T21:00:00.000Z",
        metadata: {
          providerSlug: "venice",
          modelName: "zai-org-glm-5",
        },
      },
    });
    expect(response.status).toBe(200);
    expect(executeTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        conversationId: 42,
        content: "holaaa",
        agentId: "generalist",
        requestedModelName: "zai-org-glm-5",
        stream: false,
      })
    );
    expect(diagnoseProvider).toHaveBeenCalledWith({
      modelName: "zai-org-glm-5",
    });
  });

  it("returns structured errors instead of hanging before stream startup", async () => {
    const response = await handleSimpleChatRequest(
      new Request("https://example.com/api/chat/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: 42,
          content: "holaaa",
          agentId: "generalist",
        }),
      }),
      {
        authenticateRequest: vi.fn().mockRejectedValue(new Error("Invalid authentication token.")),
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      error: {
        category: "auth",
      },
    });
    expect(response.status).toBe(401);
  });

  it("replaces generic provider failures with a sanitized Venice diagnostic", async () => {
    const diagnoseProvider = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        providerSlug: "venice",
        modelName: "zai-org-glm-5",
        status: 200,
        category: "ready",
        message: "Venice generation is ready.",
      })
      .mockResolvedValueOnce({
        ok: false,
        providerSlug: "venice",
        modelName: "zai-org-glm-5",
        status: 401,
        category: "auth",
        message:
          "Venice request failed (401). Check VENICE_API_KEY or VENICE_INFERENCE_KEY.",
      });
    const response = await handleSimpleChatRequest(
      new Request("https://example.com/api/chat/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          conversationId: 42,
          content: "holaaa",
          agentId: "generalist",
        }),
      }),
      {
        authenticateRequest: vi.fn().mockResolvedValue({ id: 7 }),
        runtime: {
          executeTurn: vi
            .fn()
            .mockRejectedValue(
              new Error("the model provider failed to complete the chat turn")
            ),
        },
        diagnoseProvider,
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      error: {
        category: "provider-error",
        message:
          "Venice request failed (401). Check VENICE_API_KEY or VENICE_INFERENCE_KEY.",
        provider: {
          category: "auth",
          status: 401,
          modelName: "zai-org-glm-5",
        },
      },
    });
    expect(response.status).toBe(500);
    expect(diagnoseProvider).toHaveBeenCalledTimes(2);
  });

  it("preflights Venice before executing the chat turn", async () => {
    const executeTurn = vi.fn();
    const response = await handleSimpleChatRequest(
      new Request("https://example.com/api/chat/send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          conversationId: 42,
          content: "holaaa",
          agentId: "generalist",
          requestedModelName: "venice-retired-model",
        }),
      }),
      {
        authenticateRequest: vi.fn().mockResolvedValue({ id: 7 }),
        runtime: { executeTurn },
        diagnoseProvider: vi.fn().mockResolvedValue({
          ok: false,
          providerSlug: "venice",
          modelName: "venice-retired-model",
          status: 404,
          category: "model",
          message: "Venice request failed (404). The selected model is unavailable.",
        }),
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      error: {
        category: "provider-error",
        message: "Venice request failed (404). The selected model is unavailable.",
        provider: {
          category: "model",
          modelName: "venice-retired-model",
        },
      },
    });
    expect(response.status).toBe(503);
    expect(executeTurn).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { handleDiagnoseTurnRequest } from "./diagnose-turn-handler.js";

function buildRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://example.com/api/chat/diagnose-turn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function buildDependencies(overrides: Record<string, unknown> = {}) {
  return {
    authenticateRequest: vi.fn().mockResolvedValue({ id: 7 }),
    requireConversationOwner: vi.fn().mockResolvedValue({
      id: 42,
      summary: "Known stable context.",
    }),
    loadRecentMessages: vi.fn().mockResolvedValue([
      { role: "user" as const, content: "Earlier question" },
      { role: "assistant" as const, content: "Earlier answer" },
    ]),
    diagnoseVenice: vi.fn().mockResolvedValue({
      ok: true,
      providerSlug: "venice",
      modelName: "zai-org-glm-5",
      status: 200,
      category: "ready",
      message: "Venice generation is ready.",
    }),
    generateText: vi.fn().mockResolvedValue({
      text: "OK",
      providerSlug: "venice",
      modelName: "zai-org-glm-5",
    }),
    checkDbWriteCapability: vi.fn().mockResolvedValue(undefined),
    getDeploymentHint: vi.fn().mockReturnValue({
      nodeEnv: "production",
      defaultModel: "zai-org-glm-5",
      hasVeniceKey: true,
    }),
    now: vi
      .fn()
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(110)
      .mockReturnValueOnce(120)
      .mockReturnValueOnce(130)
      .mockReturnValueOnce(140)
      .mockReturnValueOnce(150)
      .mockReturnValueOnce(160)
      .mockReturnValueOnce(170)
      .mockReturnValueOnce(180)
      .mockReturnValueOnce(190)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(210)
      .mockReturnValueOnce(220)
      .mockReturnValueOnce(230)
      .mockReturnValueOnce(240)
      .mockReturnValueOnce(250),
    traceId: () => "diag-1",
    ...overrides,
  };
}

async function readDiagnostic(response: Response) {
  return (await response.json()) as {
    ok: boolean;
    failedStage?: string;
    stages: Array<{
      id: string;
      ok: boolean;
      category?: string;
      message?: string;
    }>;
  };
}

describe("handleDiagnoseTurnRequest", () => {
  it("requires authentication before running chat diagnostics", async () => {
    const response = await handleDiagnoseTurnRequest(buildRequest({}), {
      ...buildDependencies(),
      authenticateRequest: vi
        .fn()
        .mockRejectedValue(new Error("Invalid authentication token.")),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      traceId: "diag-1",
      stages: [
        {
          id: "auth",
          ok: false,
          category: "auth",
        },
      ],
    });
  });

  it("returns 400 with request-validation failure for invalid bodies", async () => {
    const response = await handleDiagnoseTurnRequest(
      buildRequest({ conversationId: "bad" }),
      buildDependencies()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      stages: [
        { id: "auth", ok: true },
        { id: "request-validation", ok: false, category: "transport" },
      ],
    });
  });

  it("stops at conversation-owner when the user cannot access the conversation", async () => {
    const response = await handleDiagnoseTurnRequest(
      buildRequest({
        conversationId: 42,
        content: "hola",
        agentId: "generalist",
      }),
      {
        ...buildDependencies(),
        requireConversationOwner: vi
          .fn()
          .mockRejectedValue(new Error("Conversation not found.")),
      }
    );

    expect(response.status).toBe(200);
    const payload = await readDiagnostic(response);

    expect(payload).toMatchObject({
      ok: false,
      failedStage: "conversation-owner",
    });
    expect(payload.stages.find(stage => stage.id === "conversation-owner"))
      .toMatchObject({ id: "conversation-owner", ok: false });
  });

  it("stops at recent-messages when history loading fails", async () => {
    const response = await handleDiagnoseTurnRequest(
      buildRequest({
        conversationId: 42,
        content: "hola",
        agentId: "generalist",
      }),
      {
        ...buildDependencies(),
        loadRecentMessages: vi
          .fn()
          .mockRejectedValue(new Error("Database relation messages failed.")),
      }
    );

    const payload = await readDiagnostic(response);

    expect(payload).toMatchObject({
      ok: false,
      failedStage: "recent-messages",
    });
    expect(payload.stages.find(stage => stage.id === "recent-messages"))
      .toMatchObject({ id: "recent-messages", ok: false, category: "db-error" });
  });

  it("reports Venice generation failures with sanitized provider details", async () => {
    const response = await handleDiagnoseTurnRequest(
      buildRequest({
        conversationId: 42,
        content: "hola",
        agentId: "generalist",
        requestedModelName: "retired-model",
      }),
      {
        ...buildDependencies(),
        generateText: vi
          .fn()
          .mockRejectedValue(
            new Error("Venice request failed (404). The selected model is unavailable.")
          ),
      }
    );

    const payload = await readDiagnostic(response);

    expect(payload).toMatchObject({
      ok: false,
      failedStage: "venice-generation",
    });
    expect(payload.stages.find(stage => stage.id === "venice-generation"))
      .toMatchObject({
        id: "venice-generation",
        ok: false,
        category: "provider-error",
        message:
          "Venice request failed (404). The selected model is unavailable.",
      });
  });

  it("runs the full non-destructive diagnostic path", async () => {
    const dependencies = buildDependencies();
    const response = await handleDiagnoseTurnRequest(
      buildRequest({
        conversationId: 42,
        content: "hola",
        agentId: "generalist",
        requestedModelName: "zai-org-glm-5",
      }),
      dependencies
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      traceId: "diag-1",
      deploymentHint: {
        nodeEnv: "production",
        defaultModel: "zai-org-glm-5",
        hasVeniceKey: true,
      },
      stages: [
        { id: "auth", ok: true },
        { id: "request-validation", ok: true },
        { id: "conversation-owner", ok: true },
        { id: "recent-messages", ok: true },
        { id: "venice-preflight", ok: true },
        { id: "venice-generation", ok: true },
        { id: "db-write-capability", ok: true },
        { id: "client-contract", ok: true },
      ],
    });
    expect(dependencies.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSlug: "venice",
        modelName: "zai-org-glm-5",
        messages: [{ role: "user", content: "Reply with OK." }],
      })
    );
    expect(dependencies.checkDbWriteCapability).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { VeniceFirstConversationTurnRuntime } from "./kimi-runtime.js";

describe("VeniceFirstConversationTurnRuntime", () => {
  let callOrder: string[];

  beforeEach(() => {
    callOrder = [];
  });

  function buildRuntime(
    overrides: {
      streamText?: ReturnType<typeof vi.fn>;
      generateText?: ReturnType<typeof vi.fn>;
      contextLoader?: ReturnType<typeof vi.fn>;
    } = {}
  ) {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 42,
        title: "New conversation",
        summary: "The user prefers concise strategic answers.",
      }),
      createUserMessage: vi.fn().mockImplementation(async () => {
        callOrder.push("user-message");
        return { id: 101, createdAt: new Date("2026-05-14T10:00:00.000Z") };
      }),
      createAssistantMessage: vi.fn().mockImplementation(async () => {
        callOrder.push("assistant-message");
        return { id: 202, createdAt: new Date("2026-05-14T10:00:01.000Z") };
      }),
      updateConversationAfterTurn: vi.fn().mockResolvedValue(undefined),
    };

    const agentRunRepository = {
      createPrimaryRun: vi.fn().mockImplementation(async () => {
        callOrder.push("primary-run");
        return { id: 303 };
      }),
      markPrimaryRunRunning: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRun: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRunFailure: vi.fn().mockResolvedValue(undefined),
    };

    const contextLoader =
      overrides.contextLoader ??
      vi.fn().mockImplementation(async () => {
        callOrder.push("context");
        return {
          agentDefinitionId: 9,
          systemPrompt: [
            "You are Aura Generalist.",
            "Existing conversation summary:\nThe user prefers concise strategic answers.",
          ].join("\n\n"),
          conversationSummary: "The user prefers concise strategic answers.",
          messages: [
            { role: "user" as const, content: "Earlier question" },
            { role: "assistant" as const, content: "Earlier answer" },
            { role: "user" as const, content: "Latest question" },
          ],
        };
      });

    const streamText =
      overrides.streamText ??
      vi.fn().mockImplementation(async input => {
        callOrder.push("venice-stream");
        await input.onTextDelta?.("Hola");
        await input.onTextDelta?.(" mundo");
        return {
          text: "Hola mundo",
          providerSlug: "venice",
          modelName: "zai-org-glm-5-1",
          inputTokens: 31,
          outputTokens: 7,
        };
      });

    const generateText =
      overrides.generateText ??
      vi.fn().mockResolvedValue({
        text: "Hola mundo",
        providerSlug: "venice",
        modelName: "zai-org-glm-5-1",
      });

    const runtime = new VeniceFirstConversationTurnRuntime({
      conversationRepository,
      agentRunRepository,
      contextLoader,
      modelGateway: {
        streamText,
        generateText,
        getDefaultModel: vi.fn().mockReturnValue("zai-org-glm-5-1"),
      },
      syncParticipants: vi.fn().mockResolvedValue({
        primary: { id: 9, slug: "generalist" },
        supporting: [],
      }),
      resolveModelReference: vi.fn().mockResolvedValue({
        providerId: 5,
        modelEndpointId: 6,
      }),
    });

    return {
      runtime,
      conversationRepository,
      agentRunRepository,
      contextLoader,
      streamText,
      generateText,
    };
  }

  it("persists user and assistant messages around a streamed Venice response", async () => {
    const { runtime, conversationRepository, agentRunRepository, streamText } =
      buildRuntime();
    const onTextDelta = vi.fn();
    const onStage = vi.fn();

    const result = await runtime.executeTurn({
      userId: 7,
      conversationId: 42,
      content: "Latest question",
      agentId: "generalist",
      requestedModelName: "zai-org-glm-5-1",
      stream: true,
      onStage,
      onTextDelta,
    });

    expect(callOrder).toEqual([
      "user-message",
      "primary-run",
      "context",
      "venice-stream",
      "assistant-message",
    ]);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSlug: "venice",
        modelName: "zai-org-glm-5-1",
        systemPrompt: expect.stringContaining("You are Aura Generalist."),
        messages: [
          { role: "user", content: "Earlier question" },
          { role: "assistant", content: "Earlier answer" },
          { role: "user", content: "Latest question" },
        ],
      })
    );
    expect(onStage).toHaveBeenCalledWith({
      id: "memory",
      label: "Loading recent chat context",
    });
    expect(onStage).toHaveBeenCalledWith({
      id: "draft",
      label: "Streaming Venice response",
    });
    expect(onTextDelta).toHaveBeenNthCalledWith(1, "Hola");
    expect(onTextDelta).toHaveBeenNthCalledWith(2, " mundo");
    expect(conversationRepository.createAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          engine: "aura-chat-v1",
          providerSlug: "venice",
          modelName: "zai-org-glm-5-1",
          requestedModelName: "zai-org-glm-5-1",
          inputTokens: 31,
          outputTokens: 7,
        },
      })
    );
    expect(agentRunRepository.finalizePrimaryRun).toHaveBeenCalledWith(
      303,
      expect.objectContaining({
        status: "completed",
        outputText: "Hola mundo",
        inputTokens: 31,
        outputTokens: 7,
      })
    );
    expect(result.assistantMessage.content).toBe("Hola mundo");
  });

  it("uses non-stream Venice generation when streaming is disabled", async () => {
    const { runtime, streamText, generateText } = buildRuntime();

    await runtime.executeTurn({
      userId: 7,
      conversationId: 42,
      content: "Latest question",
      agentId: "generalist",
      stream: false,
    });

    expect(generateText).toHaveBeenCalledOnce();
    expect(streamText).not.toHaveBeenCalled();
  });

  it("finalizes the primary run as failed when Venice fails", async () => {
    const providerError = new Error("Venice request failed (503).");
    const { runtime, agentRunRepository } = buildRuntime({
      streamText: vi.fn().mockRejectedValue(providerError),
    });

    await expect(
      runtime.executeTurn({
        userId: 7,
        conversationId: 42,
        content: "Latest question",
        agentId: "generalist",
        stream: true,
      })
    ).rejects.toThrow("Venice request failed (503).");

    expect(agentRunRepository.finalizePrimaryRunFailure).toHaveBeenCalledWith(
      303,
      { errorMessage: "Venice request failed (503)." }
    );
  });
});

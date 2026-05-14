import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  auraChatConversationTurnRuntime,
  VeniceFirstConversationTurnRuntime,
} from "./venice-chat-runtime.js";

describe("VeniceFirstConversationTurnRuntime", () => {
  let callOrder: string[];

  beforeEach(() => {
    callOrder = [];
  });

  it("exports the production chat runtime from the Venice-named module", () => {
    expect(auraChatConversationTurnRuntime).toBeInstanceOf(
      VeniceFirstConversationTurnRuntime
    );
  });

  function buildRuntime(
    overrides: {
      streamText?: ReturnType<typeof vi.fn>;
      generateText?: ReturnType<typeof vi.fn>;
      loadRecentMessages?: ReturnType<typeof vi.fn>;
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

    const loadRecentMessages =
      overrides.loadRecentMessages ??
      vi.fn().mockImplementation(async () => {
        callOrder.push("recent-messages");
        return [
          { role: "user" as const, content: "Earlier question" },
          { role: "assistant" as const, content: "Earlier answer" },
          { role: "user" as const, content: "Latest question" },
        ];
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
          modelName: "zai-org-glm-5",
          inputTokens: 31,
          outputTokens: 7,
        };
      });

    const generateText =
      overrides.generateText ??
      vi.fn().mockResolvedValue({
        text: "Hola mundo",
        providerSlug: "venice",
        modelName: "zai-org-glm-5",
      });

    const runtime = new VeniceFirstConversationTurnRuntime({
      conversationRepository,
      loadRecentMessages,
      modelGateway: {
        streamText,
        generateText,
        getDefaultModel: vi.fn().mockReturnValue("zai-org-glm-5"),
      },
    });

    return {
      runtime,
      conversationRepository,
      loadRecentMessages,
      streamText,
      generateText,
    };
  }

  it("persists user and assistant messages around a streamed Venice response without orchestration tables", async () => {
    const { runtime, conversationRepository, loadRecentMessages, streamText } =
      buildRuntime();
    const onTextDelta = vi.fn();
    const onStage = vi.fn();

    const result = await runtime.executeTurn({
      userId: 7,
      conversationId: 42,
      content: "Latest question",
      agentId: "generalist",
      requestedModelName: "zai-org-glm-5",
      stream: true,
      onStage,
      onTextDelta,
    });

    expect(callOrder).toEqual([
      "user-message",
      "recent-messages",
      "venice-stream",
      "assistant-message",
    ]);
    expect(loadRecentMessages).toHaveBeenCalledWith({
      conversationId: 42,
      limit: 6,
    });
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerSlug: "venice",
        modelName: "zai-org-glm-5",
        systemPrompt: expect.stringContaining(
          "You are Aura, a calm and practical generalist assistant."
        ),
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
          modelName: "zai-org-glm-5",
          requestedModelName: "zai-org-glm-5",
          inputTokens: 31,
          outputTokens: 7,
        },
      })
    );
    expect(conversationRepository.updateConversationAfterTurn).toHaveBeenCalled();
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

  it("does not write an assistant message when Venice fails", async () => {
    const providerError = new Error("Venice request failed (503).");
    const { runtime, conversationRepository } = buildRuntime({
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

    expect(conversationRepository.createAssistantMessage).not.toHaveBeenCalled();
  });
});

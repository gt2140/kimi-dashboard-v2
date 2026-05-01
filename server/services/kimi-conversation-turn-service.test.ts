import { beforeEach, describe, expect, it, vi } from "vitest";
import { MinimalKimiChatService } from "./minimal-kimi-chat-service.js";

describe("MinimalKimiChatService", () => {
  let callOrder: string[];

  beforeEach(() => {
    callOrder = [];
    vi.restoreAllMocks();
  });

  it("persists the user message, streams the Kimi answer, and saves the assistant reply", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 12,
        title: "New conversation",
      }),
      createUserMessage: vi.fn().mockImplementation(async () => {
        callOrder.push("user-message");
        return { id: 101 };
      }),
      createAssistantMessage: vi.fn().mockImplementation(async () => {
        callOrder.push("assistant-message");
        return {
          id: 202,
          createdAt: new Date("2026-05-01T03:00:00.000Z"),
        };
      }),
      updateConversationAfterTurn: vi.fn().mockImplementation(async () => {
        callOrder.push("conversation-update");
      }),
    };

    const kimiClient = {
      createChatCompletion: vi.fn(),
      streamChatCompletion: vi.fn().mockImplementation(async (_request, handlers) => {
        callOrder.push("kimi-stream");
        await handlers.onTextDelta?.("ApoB");
        await handlers.onTextDelta?.(" looks improved.");
        return {
          id: "chatcmpl-final",
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "ApoB looks improved.",
              },
            },
          ],
          usage: {
            prompt_tokens: 42,
            completion_tokens: 12,
            total_tokens: 54,
          },
        };
      }),
    };

    const onTextDelta = vi.fn();
    const onStage = vi.fn();

    const service = new MinimalKimiChatService({
      conversationRepository,
      kimiClient,
    });

    const result = await service.executeTurn({
      input: {
        conversationId: 12,
        content: "How is my ApoB trend looking?",
        agentId: "cardio-deep",
        calledAgentIds: [],
      },
      userId: 7,
      streamPrimary: true,
      onTextDelta,
      onStage,
    });

    expect(callOrder).toEqual([
      "user-message",
      "kimi-stream",
      "assistant-message",
      "conversation-update",
    ]);
    expect(onStage).not.toHaveBeenCalled();
    expect(onTextDelta).toHaveBeenNthCalledWith(1, "ApoB");
    expect(onTextDelta).toHaveBeenNthCalledWith(2, " looks improved.");
    expect(result.assistantMessage?.content).toBe("ApoB looks improved.");
    expect(conversationRepository.createAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "ApoB looks improved.",
        agentId: "cardio-deep",
      }),
    );
  });

  it("ignores helper agent ids and completes the turn as a single-agent Kimi request", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 18,
        title: "Single agent conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 111 }),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 222,
        createdAt: new Date("2026-05-01T04:00:00.000Z"),
      }),
      updateConversationAfterTurn: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      createChatCompletion: vi.fn().mockResolvedValue({
        id: "chatcmpl-fallback",
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "Te respondo con el agente principal solamente.",
            },
          },
        ],
        usage: {
          prompt_tokens: 24,
          completion_tokens: 14,
          total_tokens: 38,
        },
      }),
      streamChatCompletion: vi.fn(),
    };

    const service = new MinimalKimiChatService({
      conversationRepository,
      kimiClient,
    });

    const result = await service.executeTurn({
      input: {
        conversationId: 18,
        content: "Analiza esto sin helpers.",
        agentId: "generalist",
        calledAgentIds: ["bloodwork", "cardio-deep"],
      },
      userId: 9,
      streamPrimary: false,
    });

    expect(kimiClient.createChatCompletion).toHaveBeenCalledTimes(1);
    expect(kimiClient.streamChatCompletion).not.toHaveBeenCalled();
    expect(result.assistantMessage?.content).toBe(
      "Te respondo con el agente principal solamente.",
    );
    expect(kimiClient.createChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: "user", content: "Analiza esto sin helpers." },
        ]),
      }),
    );
    expect(conversationRepository.createUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          ignoredHelperAgentIds: ["bloodwork", "cardio-deep"],
        }),
      }),
    );
    expect(conversationRepository.updateConversationAfterTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        orchestrationMode: "single_agent",
      }),
    );
  });
});

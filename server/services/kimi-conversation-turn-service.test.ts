import { beforeEach, describe, expect, it, vi } from "vitest";
import { KimiConversationTurnService } from "./kimi-conversation-turn-service.js";

describe("KimiConversationTurnService", () => {
  let callOrder: string[];

  beforeEach(() => {
    callOrder = [];
  });

  it("persists tool-call state before streaming the final assistant answer", async () => {
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
      saveToolCallBatch: vi.fn().mockImplementation(async () => {
        callOrder.push("persist-tool-calls");
      }),
      createMessageContextBlocks: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      createChatCompletion: vi
        .fn()
        .mockImplementationOnce(async () => {
          callOrder.push("initial-completion");
          return {
            id: "chatcmpl-initial",
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: "",
                  tool_calls: [
                    {
                      id: "tool-1",
                      type: "function",
                      function: {
                        name: "search_memory",
                        arguments: JSON.stringify({ query: "ldl apob trend" }),
                      },
                    },
                  ],
                },
              },
            ],
            usage: {
              prompt_tokens: 120,
              completion_tokens: 20,
              total_tokens: 140,
            },
          };
        }),
      streamChatCompletion: vi.fn().mockImplementation(async (_request, handlers) => {
        callOrder.push("final-stream");
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
            prompt_tokens: 180,
            completion_tokens: 32,
            total_tokens: 212,
          },
        };
      }),
    };

    const toolExecutor = {
      getEnabledTools: vi.fn().mockResolvedValue([
        {
          function: {
            name: "search_memory",
          },
        },
      ]),
      executeToolCalls: vi.fn().mockResolvedValue([
        {
          toolCallId: "tool-1",
          toolName: "search_memory",
          content: JSON.stringify({
            result: "Stored memory says the user is working on LDL and ApoB.",
          }),
        },
      ]),
    };

    const contextLoader = vi.fn().mockResolvedValue({
      systemPrompt: "You are Generalist.",
      responseStyle: "detailed",
      recentMessages: [],
      conversationSummary: "Prior turns discussed lipids.",
      longTermMemories: [{ key: "goal", value: "Lower ApoB" }],
      selectedVaultChunks: [],
      relatedVaultFiles: [],
      enabledFormulaTools: ["moonshot/memory:latest"],
      thinkingMode: "enabled",
      promptCacheKey: "kimi:v1:conversation:12",
      safetyIdentifier: "user-12",
    });

    const service = new KimiConversationTurnService({
      conversationRepository,
      agentRunRepository,
      kimiClient,
      toolExecutor,
      contextLoader,
    });

    const result = await service.executeTurn({
      input: {
        conversationId: 12,
        content: "How is my ApoB trend looking?",
        agentId: "generalist",
        calledAgentIds: [],
      },
      userId: 7,
      streamPrimary: true,
      onTextDelta: vi.fn(),
      onStage: vi.fn(),
    });

    expect(callOrder).toEqual([
      "user-message",
      "primary-run",
      "initial-completion",
      "persist-tool-calls",
      "final-stream",
      "assistant-message",
    ]);
    expect(agentRunRepository.finalizePrimaryRun).toHaveBeenCalledWith(
      303,
      expect.objectContaining({
        status: "completed",
        outputText: "ApoB looks improved.",
        finishReason: "stop",
        providerRequestId: "chatcmpl-final",
        toolCallsJson: [
          expect.objectContaining({
            id: "tool-1",
          }),
        ],
        usageJson: expect.objectContaining({
          totalTokens: 212,
        }),
      }),
    );
    expect(result.assistantMessage?.content).toBe("ApoB looks improved.");
  });

  it("falls back to a direct Kimi answer when official tools are unavailable", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 18,
        title: "Fallback conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 111 }),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 222,
        createdAt: new Date("2026-05-01T04:00:00.000Z"),
      }),
      updateConversationAfterTurn: vi.fn().mockResolvedValue(undefined),
    };

    const agentRunRepository = {
      createPrimaryRun: vi.fn().mockResolvedValue({ id: 333 }),
      markPrimaryRunRunning: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRun: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRunFailure: vi.fn().mockResolvedValue(undefined),
      saveToolCallBatch: vi.fn().mockResolvedValue(undefined),
      createMessageContextBlocks: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      createChatCompletion: vi.fn().mockResolvedValue({
        id: "chatcmpl-fallback",
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "Te respondo directamente sin tools oficiales.",
            },
          },
        ],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 24,
          total_tokens: 104,
        },
      }),
      streamChatCompletion: vi.fn().mockResolvedValue({
        id: "chatcmpl-fallback-stream",
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "Te respondo directamente sin tools oficiales.",
            },
          },
        ],
        usage: {
          prompt_tokens: 80,
          completion_tokens: 24,
          total_tokens: 104,
        },
      }),
    };

    const toolExecutor = {
      getEnabledTools: vi
        .fn()
        .mockRejectedValue(new Error("Tool registry unavailable")),
      executeToolCalls: vi.fn(),
    };

    const contextLoader = vi.fn().mockResolvedValue({
      systemPrompt: "You are Generalist.",
      responseStyle: "detailed",
      recentMessages: [],
      conversationSummary: null,
      longTermMemories: [],
      selectedVaultChunks: [],
      relatedVaultFiles: [],
      enabledFormulaTools: [
        "moonshot/memory:latest",
        "moonshot/web-search:latest",
      ],
      thinkingMode: "enabled",
      promptCacheKey: "kimi:v1:conversation:18",
      safetyIdentifier: "user-18",
    });

    const service = new KimiConversationTurnService({
      conversationRepository,
      agentRunRepository,
      kimiClient,
      toolExecutor,
      contextLoader,
    });

    const result = await service.executeTurn({
      input: {
        conversationId: 18,
        content: "Analiza este caso aunque no tengas tools.",
        agentId: "generalist",
        calledAgentIds: [],
      },
      userId: 9,
      streamPrimary: false,
    });

    expect(toolExecutor.getEnabledTools).toHaveBeenCalledTimes(1);
    expect(kimiClient.createChatCompletion).toHaveBeenCalled();
    expect(kimiClient.createChatCompletion.mock.calls[0]?.[0]).not.toHaveProperty(
      "tools",
    );
    expect(toolExecutor.executeToolCalls).not.toHaveBeenCalled();
    expect(result.assistantMessage?.content).toBe(
      "Te respondo directamente sin tools oficiales.",
    );
    expect(agentRunRepository.finalizePrimaryRun).toHaveBeenCalledWith(
      333,
      expect.objectContaining({
        status: "completed",
        toolCallsJson: [],
      }),
    );
  });
});

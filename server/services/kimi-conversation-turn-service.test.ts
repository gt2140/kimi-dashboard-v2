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
    const finalRequest = kimiClient.streamChatCompletion.mock.calls[0]?.[0];
    expect(finalRequest.messages).not.toContainEqual(
      expect.objectContaining({
        role: "assistant",
        content: "",
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

  it("streams immediately without a planning completion when no tools are enabled", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 19,
        title: "Direct stream conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 211 }),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 212,
        createdAt: new Date("2026-05-05T15:00:00.000Z"),
      }),
      updateConversationAfterTurn: vi.fn().mockResolvedValue(undefined),
    };

    const agentRunRepository = {
      createPrimaryRun: vi.fn().mockResolvedValue({ id: 313 }),
      markPrimaryRunRunning: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRun: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRunFailure: vi.fn().mockResolvedValue(undefined),
      saveToolCallBatch: vi.fn().mockResolvedValue(undefined),
      createMessageContextBlocks: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      createChatCompletion: vi.fn(),
      streamChatCompletion: vi.fn().mockImplementation(async (_request, handlers) => {
        await handlers.onTextDelta?.("Respira");
        await handlers.onTextDelta?.(" mejor.");
        return {
          id: "chatcmpl-direct-stream",
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: "Respira mejor.",
              },
            },
          ],
          usage: {
            prompt_tokens: 60,
            completion_tokens: 12,
            total_tokens: 72,
          },
        };
      }),
    };

    const toolExecutor = {
      getEnabledTools: vi.fn().mockResolvedValue([]),
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
      enabledFormulaTools: [],
      thinkingMode: "enabled",
    });

    const service = new KimiConversationTurnService({
      conversationRepository,
      agentRunRepository,
      kimiClient,
      toolExecutor,
      contextLoader,
    });

    const onTextDelta = vi.fn();
    const result = await service.executeTurn({
      input: {
        conversationId: 19,
        content: "Ayudame rapido con esta congestion.",
        agentId: "generalist",
        calledAgentIds: [],
      },
      userId: 9,
      streamPrimary: true,
      onTextDelta,
    });

    expect(kimiClient.createChatCompletion).toHaveBeenCalledTimes(1);
    expect(kimiClient.streamChatCompletion).toHaveBeenCalledTimes(1);
    expect(onTextDelta).toHaveBeenCalledTimes(2);
    expect(result.assistantMessage?.content).toBe("Respira mejor.");
  });

  it("persists aura medical runtime metadata and extracted research evidence", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 29,
        title: "Research conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 501 }),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 502,
        createdAt: new Date("2026-05-05T03:00:00.000Z"),
      }),
      updateConversationAfterTurn: vi.fn().mockResolvedValue(undefined),
    };

    const agentRunRepository = {
      createPrimaryRun: vi.fn().mockResolvedValue({ id: 503 }),
      markPrimaryRunRunning: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRun: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRunFailure: vi.fn().mockResolvedValue(undefined),
      saveToolCallBatch: vi.fn().mockResolvedValue(undefined),
      createMessageContextBlocks: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      createChatCompletion: vi
        .fn()
        .mockResolvedValueOnce({
          id: "chatcmpl-initial-research",
          choices: [
            {
              finish_reason: "tool_calls",
              message: {
                role: "assistant",
                content: "I need evidence.",
                tool_calls: [
                  {
                    id: "tool-research-1",
                    type: "function",
                    function: {
                      name: "web_search",
                      arguments: JSON.stringify({ query: "apob pubmed trial" }),
                    },
                  },
                ],
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 12,
            total_tokens: 112,
          },
        }),
      streamChatCompletion: vi.fn().mockResolvedValue({
        id: "chatcmpl-final-research",
        choices: [
          {
            finish_reason: "stop",
            message: {
              role: "assistant",
              content: "The strongest evidence still points to ApoB lowering.",
            },
          },
        ],
        usage: {
          prompt_tokens: 160,
          completion_tokens: 32,
          total_tokens: 192,
        },
      }),
    };

    const toolExecutor = {
      getEnabledTools: vi.fn().mockResolvedValue([
        {
          function: {
            name: "web_search",
          },
        },
      ]),
      executeToolCalls: vi.fn().mockResolvedValue([
        {
          toolCallId: "tool-research-1",
          toolName: "web_search",
          content: [
            "ApoB and cardiovascular risk",
            "https://pubmed.ncbi.nlm.nih.gov/39876543/",
            "Lipoprotein(a) trial update",
            "https://clinicaltrials.gov/study/NCT01234567",
          ].join("\n"),
        },
      ]),
    };

    const contextLoader = vi.fn().mockResolvedValue({
      systemPrompt: "You are Aura Medical Runtime.",
      responseStyle: "academic",
      recentMessages: [],
      conversationSummary: "The user is comparing ApoB evidence.",
      longTermMemories: [],
      selectedVaultChunks: [],
      relatedVaultFiles: ["apob-panel.pdf"],
      enabledFormulaTools: [
        "moonshot/memory:latest",
        "moonshot/web-search:latest",
        "moonshot/rethink:latest",
      ],
      thinkingMode: "disabled",
    } as any);

    const service = new KimiConversationTurnService({
      conversationRepository,
      agentRunRepository,
      kimiClient,
      toolExecutor,
      contextLoader,
    });

    const result = await service.executeTurn({
      input: {
        conversationId: 29,
        content: "What does the recent evidence say about ApoB lowering?",
        agentId: "research-synthesizer",
        calledAgentIds: [],
        runtimeVersion: "aura-medical-v1",
        medicalMode: "research",
        policyLevel: "interpretive-on-request",
      } as any,
      userId: 14,
      streamPrimary: true,
      onTextDelta: vi.fn(),
      onStage: vi.fn(),
    });

    expect(result.assistantMessage?.metadata).toEqual(
      expect.objectContaining({
        runtimeVersion: "aura-medical-v1",
        medicalMode: "research",
        policyLevel: "interpretive-on-request",
        researchEvidence: expect.arrayContaining([
          expect.objectContaining({
            source: "pubmed",
          }),
          expect.objectContaining({
            source: "clinicaltrials",
          }),
        ]),
      }),
    );
  });

  it("falls back to a direct answer when the initial tool-planning completion times out", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 41,
        title: "Symptom chat",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 601 }),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 602,
        createdAt: new Date("2026-05-05T14:20:00.000Z"),
      }),
      updateConversationAfterTurn: vi.fn().mockResolvedValue(undefined),
    };

    const agentRunRepository = {
      createPrimaryRun: vi.fn().mockResolvedValue({ id: 603 }),
      markPrimaryRunRunning: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRun: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRunFailure: vi.fn().mockResolvedValue(undefined),
      saveToolCallBatch: vi.fn().mockResolvedValue(undefined),
      createMessageContextBlocks: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      createChatCompletion: vi
        .fn()
        .mockRejectedValueOnce(
          new Error("Kimi request timed out while calling /chat/completions."),
        )
        .mockResolvedValueOnce({
          id: "chatcmpl-fallback-direct",
          choices: [
            {
              finish_reason: "stop",
              message: {
                role: "assistant",
                content:
                  "Si te cuesta respirar y el descongestivo ya no ayuda, no sigas repitiendolo toda la noche. Eso puede pasar cuando el spray deja rebote. Si la falta de aire es importante o empeora, busca atencion medica urgente.",
              },
            },
          ],
          usage: {
            prompt_tokens: 90,
            completion_tokens: 40,
            total_tokens: 130,
          },
        }),
      streamChatCompletion: vi.fn(),
    };

    const toolExecutor = {
      getEnabledTools: vi.fn().mockResolvedValue([
        {
          function: {
            name: "web_search",
          },
        },
      ]),
      executeToolCalls: vi.fn(),
    };

    const contextLoader = vi.fn().mockResolvedValue({
      systemPrompt: "You are Aura Medical Runtime.",
      responseStyle: "detailed",
      recentMessages: [],
      conversationSummary: null,
      longTermMemories: [],
      selectedVaultChunks: [],
      relatedVaultFiles: [],
      enabledFormulaTools: ["moonshot/web-search:latest"],
      thinkingMode: "enabled",
      runtimeMetadata: {
        runtimeVersion: "aura-medical-v1",
        medicalMode: "personal-health",
        policyLevel: "interpretive-on-request",
      },
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
        conversationId: 41,
        content: "Tengo mucha congestion nasal y el spray no me hace efecto.",
        agentId: "generalist",
        calledAgentIds: [],
        runtimeVersion: "aura-medical-v1",
        medicalMode: "personal-health",
        policyLevel: "interpretive-on-request",
      },
      userId: 22,
      streamPrimary: false,
    });

    expect(kimiClient.createChatCompletion).toHaveBeenCalled();
    expect(toolExecutor.executeToolCalls).not.toHaveBeenCalled();
    expect(kimiClient.streamChatCompletion).not.toHaveBeenCalled();
    expect(result.assistantMessage?.metadata).toEqual(
      expect.objectContaining({
        toolWarnings: expect.arrayContaining([
          expect.stringContaining("timed out"),
        ]),
      }),
    );
    expect(result.assistantMessage?.content).toContain("no sigas repitiendolo");
  });
});

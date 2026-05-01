import {
  buildKimiChatRequest,
  extractKimiAssistantText,
  extractKimiUsage,
  type KimiChatRequest,
  type KimiToolCall,
} from "../kimi/chat-client.js";
import {
  buildKimiPromptCacheKey,
  buildLongTermMemorySnippet,
  buildShortTermMemoryWindow,
} from "./kimi-memory.js";
import { persistKimiTurnMemory } from "./kimi-memory-persistence.js";

type ConversationTurnInput = {
  conversationId: number;
  content: string;
  agentId: string;
  calledAgentIds: string[];
};

type ChatStage = {
  id: string;
  label: string;
};

type KimiCompletionResponse = {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: KimiToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
  };
};

type ToolResult = {
  toolCallId: string;
  toolName: string;
  content: string;
};

type RunMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ContextLoaderResult = {
  agentDefinitionId?: number;
  systemPrompt: string;
  customContext?: string | null;
  trainingNotes?: string | null;
  responseStyle: "concise" | "detailed" | "academic";
  recentMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  conversationSummary: string | null;
  longTermMemories: Array<{
    key: string;
    value: string;
    confidence?: number | null;
  }>;
  selectedVaultChunks: Array<{
    vaultFileId: number;
    chunkIndex: number;
    content: string;
  }>;
  relatedVaultFiles: string[];
  enabledFormulaTools: string[];
  thinkingMode: "enabled" | "disabled";
  promptCacheKey?: string | null;
  safetyIdentifier?: string | null;
};

type ConversationRepositoryLike = {
  requireConversationOwner: (
    conversationId: number,
    userId: number,
  ) => Promise<{ id: number; title: string | null }>;
  createUserMessage: (params: {
    conversationId: number;
    content: string;
    agentId: string;
    metadata?: Record<string, unknown>;
  }) => Promise<{ id: number }>;
  createAssistantMessage: (params: {
    conversationId: number;
    content: string;
    agentId: string;
    metadata?: Record<string, unknown>;
  }) => Promise<{ id: number; createdAt: Date }>;
  updateConversationAfterTurn: (params: {
    conversation: { id: number; title: string | null };
    userMessage: string;
    agentId: string;
    orchestrationMode: "single_agent";
  }) => Promise<void>;
};

type AgentRunRepositoryLike = {
  createPrimaryRun: (params: {
    conversationId: number;
    agentDefinitionId: number;
    resolvedUserContext: string;
  }) => Promise<{ id: number }>;
  markPrimaryRunRunning: (runId: number) => Promise<void>;
  finalizePrimaryRun: (runId: number, params: {
    messageId: number;
    providerId: number | null;
    modelEndpointId: number | null;
    status: "completed" | "failed";
    inputMessages: RunMessage[];
    systemPrompt: string;
    outputText: string;
    inputTokens?: number;
    outputTokens?: number;
    errorMessage?: string | null;
    providerRequestId?: string | null;
    finishReason?: string | null;
    thinkingMode?: "enabled" | "disabled" | null;
    toolCallsJson?: unknown[];
    usageJson?: Record<string, unknown>;
  }) => Promise<void>;
  finalizePrimaryRunFailure: (runId: number, params: { errorMessage: string }) => Promise<void>;
  saveToolCallBatch: (params: {
    agentRunId: number;
    toolCalls: KimiToolCall[];
    toolResults: ToolResult[];
  }) => Promise<void>;
  createMessageContextBlocks: (params: {
    conversationId: number;
    messageId: number;
    agentRunId: number;
    relatedVaultFiles: string[];
    vaultChunks?: Array<{
      vaultFileId: number;
      chunkIndex: number;
      content: string;
    }>;
    toolResults?: ToolResult[];
  }) => Promise<void>;
};

type KimiClientLike = {
  createChatCompletion: (request: KimiChatRequest) => Promise<KimiCompletionResponse>;
  streamChatCompletion: (
    request: KimiChatRequest,
    handlers: { onTextDelta?: (delta: string) => void | Promise<void> },
  ) => Promise<KimiCompletionResponse>;
};

type ToolExecutorLike = {
  getEnabledTools: (formulaUris: string[]) => Promise<Array<Record<string, unknown>>>;
  executeToolCalls: (params: {
    toolCalls: KimiToolCall[];
    enabledFormulaUris: string[];
  }) => Promise<ToolResult[]>;
};

export class KimiConversationTurnService {
  constructor(
    private readonly dependencies: {
      conversationRepository: ConversationRepositoryLike;
      agentRunRepository: AgentRunRepositoryLike;
      kimiClient: KimiClientLike;
      toolExecutor: ToolExecutorLike;
      contextLoader: (params: {
        userId: number;
        conversationId: number;
        agentSlug: string;
        latestUserMessage: string;
      }) => Promise<ContextLoaderResult>;
    },
  ) {}

  async executeTurn(params: {
    input: ConversationTurnInput;
    userId: number;
    streamPrimary?: boolean;
    onStage?: (stage: ChatStage) => void | Promise<void>;
    onTextDelta?: (delta: string) => void | Promise<void>;
  }) {
    const { conversationRepository, agentRunRepository, contextLoader, kimiClient, toolExecutor } =
      this.dependencies;
    let primaryRunId: number | null = null;

    const conversation = await conversationRepository.requireConversationOwner(
      params.input.conversationId,
      params.userId,
    );

    try {
      await params.onStage?.({
        id: "memory",
        label: "Loading Kimi memory and Aura context",
      });

      const context = await contextLoader({
        userId: params.userId,
        conversationId: params.input.conversationId,
        agentSlug: params.input.agentId,
        latestUserMessage: params.input.content,
      });

      const userMessage = await conversationRepository.createUserMessage({
        conversationId: params.input.conversationId,
        content: params.input.content,
        agentId: params.input.agentId,
        metadata: {
          engine: "kimi-v1",
        },
      });

      const primaryRun = await agentRunRepository.createPrimaryRun({
        conversationId: params.input.conversationId,
        agentDefinitionId: context.agentDefinitionId ?? 1,
        resolvedUserContext: params.input.content,
      });
      primaryRunId = primaryRun.id;
      await agentRunRepository.markPrimaryRunRunning(primaryRun.id);

      const contextPayload = buildContextPayload({
        userMessage: params.input.content,
        recentMessages: context.recentMessages,
        summary: context.conversationSummary,
        longTermMemories: context.longTermMemories,
        selectedVaultChunks: context.selectedVaultChunks,
      });
      const resolvedSystemPrompt = [
        context.systemPrompt,
        context.customContext?.trim()
          ? `Persistent user-agent context:\n${context.customContext.trim()}`
          : "",
        context.trainingNotes?.trim()
          ? `Agent operating notes:\n${context.trainingNotes.trim()}`
          : "",
        buildResponseStyleInstruction(context.responseStyle),
        contextPayload.systemContext,
      ]
        .filter(Boolean)
        .join("\n\n");

      const tools = await toolExecutor.getEnabledTools(context.enabledFormulaTools);
      const effectiveThinkingMode =
        tools.length > 0 ? "disabled" : context.thinkingMode;
      let request = buildKimiChatRequest({
        model: "kimi-k2.6",
        systemPrompt: resolvedSystemPrompt,
        messages: contextPayload.messages,
        promptCacheKey:
          context.promptCacheKey ??
          buildKimiPromptCacheKey(params.input.conversationId),
        safetyIdentifier: context.safetyIdentifier ?? `user-${params.userId}`,
        thinking: effectiveThinkingMode,
        tools,
      });

      await params.onStage?.({
        id: "analyze",
        label: "Planning the Kimi turn",
      });

      const firstCompletion = await kimiClient.createChatCompletion(request);
      const firstChoice = firstCompletion.choices?.[0];
      const toolCalls = firstChoice?.message?.tool_calls ?? [];
      let toolResults: ToolResult[] = [];

      if (firstChoice?.finish_reason === "tool_calls" && toolCalls.length > 0) {
        await params.onStage?.({
          id: "tools",
          label: `Running ${toolCalls.length} Kimi tool call${toolCalls.length === 1 ? "" : "s"}`,
        });
        toolResults = await toolExecutor.executeToolCalls({
          toolCalls,
          enabledFormulaUris: context.enabledFormulaTools,
        });
        await agentRunRepository.saveToolCallBatch({
          agentRunId: primaryRun.id,
          toolCalls,
          toolResults,
        });

        request = buildKimiChatRequest({
          model: "kimi-k2.6",
          systemPrompt: resolvedSystemPrompt,
          promptCacheKey:
            context.promptCacheKey ??
            buildKimiPromptCacheKey(params.input.conversationId),
          safetyIdentifier: context.safetyIdentifier ?? `user-${params.userId}`,
          thinking: effectiveThinkingMode,
          messages: [
            ...contextPayload.messages,
            {
              role: "assistant",
              content: firstChoice.message?.content ?? "",
              toolCalls,
            },
            ...toolResults.map(result => ({
              role: "tool" as const,
              content: result.content,
              name: result.toolName,
              toolCallId: result.toolCallId,
            })),
          ],
          tools,
        });
      }

      await params.onStage?.({
        id: "draft",
        label: "Streaming final answer from Kimi",
      });

      const finalCompletion = params.streamPrimary
        ? await kimiClient.streamChatCompletion(request, {
            onTextDelta: params.onTextDelta,
          })
        : await kimiClient.createChatCompletion(request);

      const outputText = extractKimiAssistantText(finalCompletion);
      const assistantMetadata = {
        engine: "kimi-v1",
        providerSlug: "kimi",
        modelName: "kimi-k2.6",
        promptCacheKey:
          context.promptCacheKey ??
          buildKimiPromptCacheKey(params.input.conversationId),
        thinkingMode: effectiveThinkingMode,
        requestedThinkingMode: context.thinkingMode,
        relatedVaultFiles: context.relatedVaultFiles,
        contextSummary: context.conversationSummary ?? undefined,
        memoryApplied: context.longTermMemories.length > 0,
        toolCalls: toolCalls.map(toolCall => toolCall.function.name),
        toolResults: toolResults.map(result => result.toolName),
        finishReason: finalCompletion.choices?.[0]?.finish_reason ?? null,
        usage: extractKimiUsage(finalCompletion),
      };

      const assistantMessage = await conversationRepository.createAssistantMessage({
        conversationId: params.input.conversationId,
        content: outputText,
        agentId: params.input.agentId,
        metadata: assistantMetadata,
      });

      await conversationRepository.updateConversationAfterTurn({
        conversation,
        userMessage: params.input.content,
        agentId: params.input.agentId,
        orchestrationMode: "single_agent",
      });

      await agentRunRepository.createMessageContextBlocks({
        conversationId: params.input.conversationId,
        messageId: assistantMessage.id,
        agentRunId: primaryRun.id,
        relatedVaultFiles: context.relatedVaultFiles,
        vaultChunks: context.selectedVaultChunks,
        toolResults,
      });

      await agentRunRepository.finalizePrimaryRun(primaryRun.id, {
        messageId: assistantMessage.id,
        providerId: null,
        modelEndpointId: null,
        status: "completed",
        inputMessages: serializeRunMessages(request.messages),
        systemPrompt: resolvedSystemPrompt,
        outputText,
        inputTokens: extractKimiUsage(finalCompletion).inputTokens,
        outputTokens: extractKimiUsage(finalCompletion).outputTokens,
        providerRequestId: finalCompletion.id ?? null,
        finishReason: finalCompletion.choices?.[0]?.finish_reason ?? null,
        thinkingMode: effectiveThinkingMode,
        toolCallsJson: toolCalls,
        usageJson: extractKimiUsage(finalCompletion),
      });

      await persistKimiTurnMemory({
        userId: params.userId,
        conversationId: params.input.conversationId,
        sourceRunId: primaryRun.id,
        existingSummary: context.conversationSummary,
        recentMessages: [
          ...context.recentMessages.slice(-8),
          {
            role: "user",
            content: params.input.content,
          },
          {
            role: "assistant",
            content: outputText,
          },
        ],
        kimiClient,
      }).catch(() => null);

      return {
        success: true,
        assistantMessage: {
          id: assistantMessage.id,
          role: "assistant" as const,
          content: outputText,
          agentId: params.input.agentId,
          createdAt: assistantMessage.createdAt,
          metadata: assistantMetadata,
        },
      };
    } catch (error) {
      if (primaryRunId) {
        await agentRunRepository.finalizePrimaryRunFailure(primaryRunId, {
          errorMessage:
            error instanceof Error
              ? error.message
              : "Kimi V1 turn failed unexpectedly.",
        });
      }
      throw error;
    }
  }
}

function buildContextPayload(input: {
  userMessage: string;
  recentMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  summary: string | null;
  longTermMemories: Array<{
    key: string;
    value: string;
    confidence?: number | null;
  }>;
  selectedVaultChunks: Array<{
    vaultFileId: number;
    chunkIndex: number;
    content: string;
  }>;
}) {
  const shortTerm = buildShortTermMemoryWindow({
    summary: input.summary,
    messages: input.recentMessages,
    maxRecentMessages: 6,
  });
  const longTermSnippet = buildLongTermMemorySnippet(input.longTermMemories);
  const vaultContext =
    input.selectedVaultChunks.length > 0
      ? `Vault context:\n${input.selectedVaultChunks
          .map(chunk => `- [file ${chunk.vaultFileId} chunk ${chunk.chunkIndex}] ${chunk.content}`)
          .join("\n")}`
      : "";

  return {
    systemContext: [shortTerm.summaryBlock, longTermSnippet, vaultContext]
      .filter(Boolean)
      .join("\n\n"),
    messages: [
      ...shortTerm.recentMessages,
      { role: "user" as const, content: input.userMessage },
    ],
  };
}

function serializeRunMessages(messages: KimiChatRequest["messages"]): RunMessage[] {
  return messages
    .map(message => {
      if (
        typeof message.content !== "string" ||
        (message.role !== "system" &&
          message.role !== "user" &&
          message.role !== "assistant")
      ) {
        return null;
      }

      return {
        role: message.role,
        content: message.content,
      };
    })
    .filter((message): message is RunMessage => Boolean(message));
}

function buildResponseStyleInstruction(
  responseStyle: "concise" | "detailed" | "academic",
) {
  switch (responseStyle) {
    case "concise":
      return "Response style: keep answers compact, direct, and easy to scan.";
    case "academic":
      return "Response style: use a technical tone, distinguish evidence from inference, and surface uncertainty clearly.";
    case "detailed":
    default:
      return "Response style: be structured, practical, and sufficiently detailed without drifting into filler.";
  }
}

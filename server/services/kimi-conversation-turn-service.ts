import {
  buildKimiChatRequest,
  type BuildKimiChatRequestInput,
  extractKimiAssistantText,
  extractKimiUsage,
  type KimiChatRequest,
  type KimiToolCall,
} from "../kimi/chat-client.js";
import {
  createChatTurnTrace,
  type ChatTurnFailureKind,
} from "./chat-turn-trace.js";
import {
  buildAuraMedicalMetadata,
  resolveAuraRuntimeOptions,
} from "./aura-medical-runtime.js";
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
  runtimeVersion?: "classic" | "aura-medical-v1";
  medicalMode?: "personal-health" | "research";
  policyLevel?: "interpretive-on-request";
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

function normalizeMessageContent(content: string | null | undefined) {
  return typeof content === "string" ? content.trim() : "";
}

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
  stageLabels?: Partial<Record<"memory" | "analyze" | "tools" | "draft", string>>;
  runtimeMetadata?: Record<string, unknown>;
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
        runtimeVersion?: "classic" | "aura-medical-v1";
        medicalMode?: "personal-health" | "research";
        policyLevel?: "interpretive-on-request";
      }) => Promise<ContextLoaderResult>;
    },
  ) {}

  async executeTurn(params: {
    input: ConversationTurnInput;
    userId: number;
    streamPrimary?: boolean;
    onStage?: (stage: ChatStage) => void | Promise<void>;
    onTextDelta?: (delta: string) => void | Promise<void>;
    traceContext?: {
      requestId: string;
      route: string;
    };
  }) {
    const { conversationRepository, agentRunRepository, contextLoader, kimiClient, toolExecutor } =
      this.dependencies;
    let primaryRunId: number | null = null;
    let failureKind: ChatTurnFailureKind = "unknown";
    const trace = createChatTurnTrace({
      requestId:
        params.traceContext?.requestId ?? globalThis.crypto.randomUUID().slice(0, 8),
      route: params.traceContext?.route ?? "/api/kimi/chat/stream",
      conversationId: params.input.conversationId,
      userId: params.userId,
      agentId: params.input.agentId,
      runtimeVersion: params.input.runtimeVersion,
      medicalMode: params.input.medicalMode,
    });

    const conversation = await conversationRepository.requireConversationOwner(
      params.input.conversationId,
      params.userId,
    );

    try {
      trace.debug("start");
      await params.onStage?.({
        id: "memory",
        label: "Loading Kimi memory and Aura context",
      });
      trace.markStage("memory", "Loading Kimi memory and Aura context");

      failureKind = "context-load";
      const context = await contextLoader({
        userId: params.userId,
        conversationId: params.input.conversationId,
        agentSlug: params.input.agentId,
        latestUserMessage: params.input.content,
        runtimeVersion: params.input.runtimeVersion,
        medicalMode: params.input.medicalMode,
        policyLevel: params.input.policyLevel,
      });
      trace.debug("context.loaded", {
        hasSummary: Boolean(context.conversationSummary),
        longTermMemoryCount: context.longTermMemories.length,
        vaultChunkCount: context.selectedVaultChunks.length,
        enabledToolCount: context.enabledFormulaTools.length,
      });
      const runtimeOptions = resolveAuraRuntimeOptions({
        runtimeVersion: params.input.runtimeVersion,
        medicalMode: params.input.medicalMode,
        policyLevel: params.input.policyLevel,
      });

      const userMessage = await conversationRepository.createUserMessage({
        conversationId: params.input.conversationId,
        content: params.input.content,
        agentId: params.input.agentId,
        metadata: {
          engine: "kimi-v1",
          runtimeVersion: runtimeOptions.runtimeVersion,
          medicalMode: runtimeOptions.medicalMode,
          policyLevel: runtimeOptions.policyLevel,
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
        buildResponseStyleInstruction({
          responseStyle: context.responseStyle,
          medicalMode: runtimeOptions.medicalMode,
          agentId: params.input.agentId,
        }),
        contextPayload.systemContext,
      ]
        .filter(Boolean)
        .join("\n\n");

      let toolWarnings: string[] = [];
      let tools: Array<Record<string, unknown>> = [];

      if (context.enabledFormulaTools.length > 0) {
        try {
          tools = await toolExecutor.getEnabledTools(context.enabledFormulaTools);
        } catch (error) {
          toolWarnings.push(
            error instanceof Error
              ? error.message
              : "Official Kimi tools are unavailable for this turn.",
          );
          tools = [];
        }
      }

      let effectiveThinkingMode =
        tools.length > 0 ? "disabled" : context.thinkingMode;
      trace.debug("provider.request.prepare", {
        enabledToolCount: tools.length,
        thinkingMode: effectiveThinkingMode,
      });
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
        label: context.stageLabels?.analyze ?? "Planning the Kimi turn",
      });
      trace.markStage("analyze", context.stageLabels?.analyze ?? "Planning the Kimi turn");

      const shouldStreamDirectly = params.streamPrimary && tools.length === 0;
      let firstCompletion: KimiCompletionResponse | null = null;
      let directCompletionFromFallback = false;
      if (!shouldStreamDirectly) {
        try {
          failureKind = "provider-plan";
          firstCompletion = await kimiClient.createChatCompletion(request);
          trace.debug("provider.plan.completed", {
            finishReason: firstCompletion.choices?.[0]?.finish_reason ?? null,
          });
        } catch (error) {
          if (tools.length === 0) {
            trace.fail("provider-plan", error, {
              mode: "direct",
            });
            throw error;
          }

          toolWarnings.push(
            error instanceof Error
              ? error.message
              : "Kimi tool planning failed for this turn.",
          );
          tools = [];
          effectiveThinkingMode = context.thinkingMode;
          request = buildKimiChatRequest({
            model: "kimi-k2.6",
            systemPrompt: [
              resolvedSystemPrompt,
              "Tool planning was skipped because the tool-enabled request failed or timed out. Respond directly using the available user context, memory, and vault context.",
            ].join("\n\n"),
            promptCacheKey:
              context.promptCacheKey ??
              buildKimiPromptCacheKey(params.input.conversationId),
            safetyIdentifier: context.safetyIdentifier ?? `user-${params.userId}`,
            thinking: effectiveThinkingMode,
            messages: contextPayload.messages,
          });
          trace.debug("provider.plan.fallback-direct", {
            toolWarningCount: toolWarnings.length,
          });
          failureKind = "provider-response";
          firstCompletion = await kimiClient.createChatCompletion(request);
          directCompletionFromFallback = true;
        }
      }

      const firstChoice = firstCompletion?.choices?.[0];
      let toolCalls = firstChoice?.message?.tool_calls ?? [];
      let toolResults: ToolResult[] = [];

      if (firstChoice?.finish_reason === "tool_calls" && toolCalls.length > 0) {
        await params.onStage?.({
          id: "tools",
          label:
            context.stageLabels?.tools ??
            `Running ${toolCalls.length} Kimi tool call${toolCalls.length === 1 ? "" : "s"}`,
        });
        trace.markStage(
          "tools",
          context.stageLabels?.tools ??
            `Running ${toolCalls.length} Kimi tool call${toolCalls.length === 1 ? "" : "s"}`
        );
        try {
          toolResults = await toolExecutor.executeToolCalls({
            toolCalls,
            enabledFormulaUris: context.enabledFormulaTools,
          });
          trace.debug("tools.completed", {
            toolCallCount: toolCalls.length,
            toolResultCount: toolResults.length,
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
            messages: buildToolFollowupMessages({
              baseMessages: contextPayload.messages,
              assistantContent: firstChoice.message?.content,
              toolCalls,
              toolResults,
            }),
            tools,
          });
        } catch (error) {
          toolWarnings.push(
            error instanceof Error
              ? error.message
              : "Kimi tool execution failed for this turn.",
          );
          toolCalls = [];
          toolResults = [];
          tools = [];
          effectiveThinkingMode = context.thinkingMode;

          request = buildKimiChatRequest({
            model: "kimi-k2.6",
            systemPrompt: [
              resolvedSystemPrompt,
              "Official Kimi tools are unavailable for this turn. Respond directly using the available memory and vault context without attempting tool calls.",
            ].join("\n\n"),
            promptCacheKey:
              context.promptCacheKey ??
              buildKimiPromptCacheKey(params.input.conversationId),
            safetyIdentifier: context.safetyIdentifier ?? `user-${params.userId}`,
            thinking: effectiveThinkingMode,
            messages: contextPayload.messages,
          });
          trace.fail("provider-plan", error, {
            step: "tool-execution",
          });
        }
      }

      await params.onStage?.({
        id: "draft",
        label:
          context.stageLabels?.draft ?? "Streaming final answer from Kimi",
      });
      trace.markStage(
        "draft",
        context.stageLabels?.draft ?? "Streaming final answer from Kimi"
      );

      failureKind = params.streamPrimary ? "provider-stream" : "provider-response";
      const finalCompletion = directCompletionFromFallback
        ? firstCompletion
        : params.streamPrimary
          ? await kimiClient.streamChatCompletion(request, {
              onTextDelta: params.onTextDelta,
            })
          : await kimiClient.createChatCompletion(request);
      trace.debug("provider.response.completed", {
        streamed: Boolean(params.streamPrimary && !directCompletionFromFallback),
        finishReason: finalCompletion?.choices?.[0]?.finish_reason ?? null,
      });

      if (!finalCompletion) {
        throw new Error("Kimi did not return a completion payload.");
      }

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
        toolWarnings,
        finishReason: finalCompletion.choices?.[0]?.finish_reason ?? null,
        usage: extractKimiUsage(finalCompletion),
        ...context.runtimeMetadata,
        ...buildAuraMedicalMetadata({
          runtimeOptions,
          toolResults,
        }),
      };

      failureKind = "assistant-persist";
      const assistantMessage = await conversationRepository.createAssistantMessage({
        conversationId: params.input.conversationId,
        content: outputText,
        agentId: params.input.agentId,
        metadata: assistantMetadata,
      });
      trace.debug("assistant.persisted", {
        assistantMessageId: assistantMessage.id,
        outputLength: outputText.length,
      });

      await conversationRepository.updateConversationAfterTurn({
        conversation,
        userMessage: params.input.content,
        agentId: params.input.agentId,
        orchestrationMode: "single_agent",
      });

      failureKind = "message-context";
      await agentRunRepository.createMessageContextBlocks({
        conversationId: params.input.conversationId,
        messageId: assistantMessage.id,
        agentRunId: primaryRun.id,
        relatedVaultFiles: context.relatedVaultFiles,
        vaultChunks: context.selectedVaultChunks,
        toolResults,
      });

      failureKind = "run-finalize";
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
      trace.debug("completed", {
        assistantMessageId: assistantMessage.id,
      });

      void persistKimiTurnMemory({
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
      trace.fail(failureKind, error);
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
      const content = normalizeMessageContent(
        typeof message.content === "string" ? message.content : null,
      );
      if (
        !content ||
        (message.role !== "system" &&
          message.role !== "user" &&
          message.role !== "assistant")
      ) {
        return null;
      }

      return {
        role: message.role,
        content,
      };
    })
    .filter((message): message is RunMessage => Boolean(message));
}

function buildToolFollowupMessages(input: {
  baseMessages: BuildKimiChatRequestInput["messages"];
  assistantContent?: string | null;
  toolCalls: KimiToolCall[];
  toolResults: ToolResult[];
}): BuildKimiChatRequestInput["messages"] {
  const assistantContent = normalizeMessageContent(input.assistantContent);

  return [
    ...input.baseMessages,
    ...(assistantContent || input.toolCalls.length > 0
      ? [
          {
            role: "assistant" as const,
            ...(assistantContent ? { content: assistantContent } : {}),
            toolCalls: input.toolCalls,
          },
        ]
      : []),
    ...input.toolResults.map(result => ({
      role: "tool" as const,
      content: result.content,
      name: result.toolName,
      toolCallId: result.toolCallId,
    })),
  ];
}

function buildResponseStyleInstruction(
  input: {
    responseStyle: "concise" | "detailed" | "academic";
    medicalMode?: "personal-health" | "research";
    agentId?: string;
  },
) {
  const isResearchTurn =
    input.medicalMode === "research" || input.agentId === "research-synthesizer";

  if (isResearchTurn) {
    return [
      "Answer in structured markdown.",
      "Use short sections with short paragraphs.",
      "Lead with `Direct answer`.",
      "Use these sections when they fit the question: `Direct answer`, `What the evidence suggests`, `Evidence quality`, `Risks or limits`, `Practical takeaway`.",
      "Prefer concise bullets over long dense paragraphs.",
      "Separate established evidence from inference or speculation clearly.",
    ].join(" ");
  }

  switch (input.responseStyle) {
    case "concise":
      return [
        "Response style: keep answers compact, direct, and easy to scan.",
        "Lead with `Direct answer` and keep paragraphs short.",
      ].join(" ");
    case "academic":
      return [
        "Response style: use a technical tone, distinguish evidence from inference, and surface uncertainty clearly.",
        "Use structured markdown with short sections and short paragraphs.",
      ].join(" ");
    case "detailed":
    default:
      return [
        "Response style: be structured, practical, and sufficiently detailed without drifting into filler.",
        "Lead with `Direct answer`, then use short sections for `What stands out`, `What this may mean`, and `Best next step` when helpful.",
        "Prefer bullets over dense blocks of prose.",
      ].join(" ");
  }
}

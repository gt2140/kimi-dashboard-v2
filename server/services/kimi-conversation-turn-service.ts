import {
  buildKimiChatRequest,
  extractKimiAssistantText,
  extractKimiUsage,
  type KimiChatRequest,
} from "../kimi/chat-client.js";
import { buildKimiPromptCacheKey, buildShortTermMemoryWindow } from "./kimi-memory.js";

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
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
  };
};

type ContextLoaderResult = {
  systemPrompt: string;
  responseStyle: "concise" | "detailed" | "academic";
  recentMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
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

type KimiClientLike = {
  createChatCompletion: (request: KimiChatRequest) => Promise<KimiCompletionResponse>;
  streamChatCompletion: (
    request: KimiChatRequest,
    handlers: { onTextDelta?: (delta: string) => void | Promise<void> },
  ) => Promise<KimiCompletionResponse>;
};

export class KimiConversationTurnService {
  constructor(
    private readonly dependencies: {
      conversationRepository: ConversationRepositoryLike;
      kimiClient: KimiClientLike;
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
    const { conversationRepository, contextLoader, kimiClient } = this.dependencies;

    const conversation = await conversationRepository.requireConversationOwner(
      params.input.conversationId,
      params.userId,
    );

    await params.onStage?.({
      id: "analyze",
      label: "Analyzing your message",
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
        engine: "kimi-v1-minimal",
        ignoredHelperAgentIds: params.input.calledAgentIds,
      },
    });

    const contextPayload = buildContextPayload({
      userMessage: params.input.content,
      recentMessages: context.recentMessages,
    });

    const resolvedSystemPrompt = [
      context.systemPrompt,
      buildResponseStyleInstruction(context.responseStyle),
      contextPayload.systemContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    await params.onStage?.({
      id: "context",
      label: "Reviewing available context",
    });

    const request = buildKimiChatRequest({
      model: "kimi-k2.6",
      systemPrompt: resolvedSystemPrompt,
      messages: contextPayload.messages,
      promptCacheKey:
        context.promptCacheKey ??
        buildKimiPromptCacheKey(params.input.conversationId),
      safetyIdentifier: context.safetyIdentifier ?? `user-${params.userId}`,
      thinking: context.thinkingMode,
    });

    await params.onStage?.({
      id: "draft",
      label: "Drafting the answer",
    });

    const completion = params.streamPrimary
      ? await kimiClient.streamChatCompletion(request, {
          onTextDelta: params.onTextDelta,
        })
      : await kimiClient.createChatCompletion(request);

    const outputText = extractKimiAssistantText(completion);
    const assistantMetadata = {
      engine: "kimi-v1-minimal",
      providerSlug: "kimi",
      modelName: "kimi-k2.6",
      promptCacheKey:
        context.promptCacheKey ??
        buildKimiPromptCacheKey(params.input.conversationId),
      requestedThinkingMode: context.thinkingMode,
      finishReason: completion.choices?.[0]?.finish_reason ?? null,
      usage: extractKimiUsage(completion),
      ignoredHelperAgentIds: params.input.calledAgentIds,
      userMessageId: userMessage.id,
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
  }
}

function buildContextPayload(input: {
  userMessage: string;
  recentMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}) {
  const shortTerm = buildShortTermMemoryWindow({
    messages: input.recentMessages,
    maxRecentMessages: 6,
  });

  return {
    systemContext: "",
    messages: [
      ...shortTerm.recentMessages,
      { role: "user" as const, content: input.userMessage },
    ],
  };
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

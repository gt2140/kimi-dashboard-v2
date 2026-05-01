import {
  buildKimiChatRequest,
  extractKimiAssistantText,
  extractKimiUsage,
  type KimiChatRequest,
} from "../kimi/chat-client.js";
import { AGENTS } from "../../src/lib/data.js";

type ConversationTurnInput = {
  conversationId: number;
  content: string;
  agentId: string;
  calledAgentIds: string[];
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

type KimiClientLike = {
  createChatCompletion: (request: KimiChatRequest) => Promise<KimiCompletionResponse>;
  streamChatCompletion: (
    request: KimiChatRequest,
    handlers: { onTextDelta?: (delta: string) => void | Promise<void> },
  ) => Promise<KimiCompletionResponse>;
};

export class MinimalKimiChatService {
  constructor(
    private readonly dependencies: {
      conversationRepository: ConversationRepositoryLike;
      kimiClient: KimiClientLike;
    },
  ) {}

  async executeTurn(params: {
    input: ConversationTurnInput;
    userId: number;
    streamPrimary?: boolean;
    onTextDelta?: (delta: string) => void | Promise<void>;
  }) {
    const { conversationRepository, kimiClient } = this.dependencies;
    const conversation = await conversationRepository.requireConversationOwner(
      params.input.conversationId,
      params.userId,
    );

    const agent =
      AGENTS.find(candidate => candidate.id === params.input.agentId) ?? AGENTS[0];

    const userMessage = await conversationRepository.createUserMessage({
      conversationId: params.input.conversationId,
      content: params.input.content,
      agentId: params.input.agentId,
      metadata: {
        engine: "kimi-v0-direct",
        ignoredHelperAgentIds: params.input.calledAgentIds,
      },
    });

    const request = buildKimiChatRequest({
      model: "kimi-k2.6",
      systemPrompt: agent.systemPrompt,
      messages: [{ role: "user", content: params.input.content }],
      safetyIdentifier: `user-${params.userId}`,
      thinking: "disabled",
    });

    const completion = params.streamPrimary
      ? await kimiClient.streamChatCompletion(request, {
          onTextDelta: params.onTextDelta,
        })
      : await kimiClient.createChatCompletion(request);

    const outputText = extractKimiAssistantText(completion);
    const assistantMetadata = {
      engine: "kimi-v0-direct",
      providerSlug: "kimi",
      modelName: "kimi-k2.6",
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

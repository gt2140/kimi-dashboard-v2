import { desc, eq } from "drizzle-orm";
import { messages } from "../../db/schema.js";
import { logServerDebug } from "../lib/debug.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { getDb } from "../queries/connection.js";
import {
  type ConversationTurnRuntime,
  type ConversationTurnRuntimeInput,
} from "./conversation-turn-runtime.js";
import { ModelGatewayService } from "./model-gateway.js";

type RuntimeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ConversationRepositoryLike = Pick<
  ConversationRepository,
  | "requireConversationOwner"
  | "createUserMessage"
  | "createAssistantMessage"
  | "updateConversationAfterTurn"
>;

type ModelGatewayLike = Pick<
  ModelGatewayService,
  "generateText" | "streamText" | "getDefaultModel"
>;

type RecentMessageLoader = (params: {
  conversationId: number;
  limit: number;
}) => Promise<RuntimeMessage[]>;

async function loadRecentConversationMessages(params: {
  conversationId: number;
  limit: number;
}): Promise<RuntimeMessage[]> {
  const db = getDb();
  const recentRows = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, params.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(params.limit);

  return recentRows.reverse().map(message => ({
    role: message.role,
    content: message.content,
  }));
}

export class VeniceFirstConversationTurnRuntime implements ConversationTurnRuntime {
  private readonly conversationRepository: ConversationRepositoryLike;
  private readonly modelGateway: ModelGatewayLike;
  private readonly loadRecentMessages: RecentMessageLoader;

  constructor(
    dependencies: {
      conversationRepository?: ConversationRepositoryLike;
      modelGateway?: ModelGatewayLike;
      loadRecentMessages?: RecentMessageLoader;
    } = {}
  ) {
    this.conversationRepository =
      dependencies.conversationRepository ?? new ConversationRepository();
    this.modelGateway = dependencies.modelGateway ?? new ModelGatewayService();
    this.loadRecentMessages =
      dependencies.loadRecentMessages ?? loadRecentConversationMessages;
  }

  async executeTurn(input: ConversationTurnRuntimeInput) {
    logServerDebug("chat.turn.venice.start", {
      conversationId: input.conversationId,
      userId: input.userId,
      agentId: input.agentId,
      requestedModelName: input.requestedModelName ?? null,
      streamed: input.stream,
    });

    const conversation =
      await this.conversationRepository.requireConversationOwner(
        input.conversationId,
        input.userId
      );

    await input.onStage?.({
      id: "memory",
      label: "Loading recent chat context",
    });

    const userMessage = await this.conversationRepository.createUserMessage({
      conversationId: input.conversationId,
      content: input.content,
      agentId: input.agentId,
      metadata: {},
    });

    try {
      const recentMessages = await this.loadRecentMessages({
        conversationId: input.conversationId,
        limit: 6,
      });
      const systemPrompt = [
        "You are Aura, a calm and practical generalist assistant.",
        conversation.summary?.trim()
          ? `Existing conversation summary:\n${conversation.summary.trim()}`
          : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n\n");

      await input.onStage?.({
        id: "draft",
        label: input.stream
          ? "Streaming Venice response"
          : "Writing Venice response",
      });

      const requestedModelName = input.requestedModelName?.trim() || null;
      const modelResult = input.stream
        ? await this.modelGateway.streamText({
            providerSlug: "venice",
            modelName: requestedModelName,
            systemPrompt,
            messages: recentMessages,
            signal: input.signal,
            onTextDelta: input.onTextDelta,
          })
        : await this.modelGateway.generateText({
            providerSlug: "venice",
            modelName: requestedModelName,
            systemPrompt,
            messages: recentMessages,
            signal: input.signal,
          });

      const assistantMetadata = {
        engine: "aura-chat-v1" as const,
        providerSlug: "venice" as const,
        modelName: modelResult.modelName,
        requestedModelName,
        inputTokens: modelResult.inputTokens,
        outputTokens: modelResult.outputTokens,
      };

      const assistantMessage =
        await this.conversationRepository.createAssistantMessage({
          conversationId: input.conversationId,
          content: modelResult.text,
          agentId: input.agentId,
          metadata: assistantMetadata,
        });

      await this.conversationRepository.updateConversationAfterTurn({
        conversation,
        userMessage: input.content,
        agentId: input.agentId,
        orchestrationMode: "single_agent",
      });

      logServerDebug("chat.turn.venice.completed", {
        conversationId: input.conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        modelName: modelResult.modelName,
      });

      return {
        success: true as const,
        assistantMessage: {
          id: assistantMessage.id,
          role: "assistant" as const,
          content: modelResult.text,
          agentId: input.agentId,
          createdAt: assistantMessage.createdAt,
          metadata: assistantMetadata,
        },
      };
    } catch (error) {
      throw error;
    }
  }
}

export const auraChatConversationTurnRuntime =
  new VeniceFirstConversationTurnRuntime();

export { loadRecentConversationMessages };

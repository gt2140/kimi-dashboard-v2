import { AGENTS } from "../../src/lib/data.js";
import { buildConversationTitle, MvpChatStore } from "./chat-store.js";
import { KimiDirectClient } from "./kimi-direct-client.js";

export class MvpChatTurnService {
  constructor(
    private readonly store: MvpChatStore,
    private readonly kimiClient: KimiDirectClient,
  ) {}

  async execute(params: {
    conversationId?: number;
    content: string;
    agentId: string;
    userId: number;
  }) {
    const conversationId =
      params.conversationId ??
      (
        await this.store.createConversation({
          userId: params.userId,
          agentId: params.agentId,
          title: buildConversationTitle(params.content),
        })
      ).id;

    const conversation = await this.store.requireConversation(
      params.userId,
      conversationId,
    );

    await this.store.createUserMessage({
      conversationId,
      agentId: params.agentId,
      content: params.content,
    });

    const agent =
      AGENTS.find(candidate => candidate.id === params.agentId) ?? AGENTS[0];
    const recentMessages = await this.store.listRecentMessages(
      conversationId,
    );

    const reply = await this.kimiClient.respond({
      messages: [
        {
          role: "system",
          content: agent.systemPrompt,
        },
        ...recentMessages,
      ],
      userId: params.userId,
    });

    const assistantMessage = await this.store.createAssistantMessage({
      conversationId,
      agentId: params.agentId,
      content: reply.content,
      metadata: {
        engine: "kimi-mvp",
        providerSlug: "kimi",
        modelName: reply.model,
        finishReason: reply.finishReason,
        usage: reply.usage,
      },
    });

    await this.store.finalizeConversation({
      conversationId,
      currentTitle: conversation.title,
      agentId: params.agentId,
      userMessage: params.content,
    });

    return {
      conversationId,
      id: String(assistantMessage.id),
      role: "assistant" as const,
      content: reply.content,
      agentId: params.agentId,
      createdAt: assistantMessage.createdAt.toISOString(),
      metadata: {
        engine: "kimi-mvp",
        providerSlug: "kimi",
        modelName: reply.model,
        finishReason: reply.finishReason,
        usage: reply.usage,
      },
    };
  }
}

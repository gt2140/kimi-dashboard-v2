import { AGENTS } from "../../src/lib/data.js";
import { MvpChatStore } from "./chat-store.js";
import { KimiDirectClient } from "./kimi-direct-client.js";

export class MvpChatTurnService {
  constructor(
    private readonly store: MvpChatStore,
    private readonly kimiClient: KimiDirectClient,
  ) {}

  async execute(params: {
    conversationId: number;
    content: string;
    agentId: string;
    userId: number;
  }) {
    const conversation = await this.store.requireConversation(
      params.userId,
      params.conversationId,
    );

    await this.store.createUserMessage({
      conversationId: params.conversationId,
      agentId: params.agentId,
      content: params.content,
    });

    const agent =
      AGENTS.find(candidate => candidate.id === params.agentId) ?? AGENTS[0];

    const reply = await this.kimiClient.respond({
      systemPrompt: agent.systemPrompt,
      userMessage: params.content,
      userId: params.userId,
    });

    const assistantMessage = await this.store.createAssistantMessage({
      conversationId: params.conversationId,
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
      conversationId: params.conversationId,
      currentTitle: conversation.title,
      agentId: params.agentId,
      userMessage: params.content,
    });

    return {
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

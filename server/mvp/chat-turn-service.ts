import { AGENTS } from "../../src/lib/data.js";
import { logServerDebug } from "../lib/debug.js";
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
    logServerDebug("kimi.chat-turn.start", {
      userId: params.userId,
      conversationId: params.conversationId,
      agentId: params.agentId,
    });

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
    const recentMessages = await this.store.listRecentMessages(
      params.conversationId,
    );

    logServerDebug("kimi.chat-turn.context.ready", {
      conversationId: params.conversationId,
      recentMessageCount: recentMessages.length,
      agentId: agent.id,
    });

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

    const metadata = {
      engine: "kimi-mvp",
      providerSlug: "kimi",
      modelName: reply.model,
      finishReason: reply.finishReason,
      usage: reply.usage,
    };

    const assistantMessage = await this.store.createAssistantMessage({
      conversationId: params.conversationId,
      agentId: params.agentId,
      content: reply.content,
      metadata,
    });

    await this.store.finalizeConversation({
      conversationId: params.conversationId,
      currentTitle: conversation.title,
      agentId: params.agentId,
      userMessage: params.content,
    });

    logServerDebug("kimi.chat-turn.success", {
      userId: params.userId,
      conversationId: params.conversationId,
      agentId: params.agentId,
    });

    return {
      id: String(assistantMessage.id),
      role: "assistant" as const,
      content: reply.content,
      agentId: params.agentId,
      createdAt: assistantMessage.createdAt.toISOString(),
      metadata,
    };
  }
}

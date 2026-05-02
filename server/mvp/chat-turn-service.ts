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
    conversationId?: number;
    content: string;
    agentId: string;
    userId: number;
  }) {
    let conversationId = params.conversationId;
    let conversationTitle: string | null = null;

    if (conversationId == null) {
      const created = await this.store.createConversation({
        userId: params.userId,
        agentId: params.agentId,
        title: params.content.slice(0, 60),
      });
      conversationId = created.id;
      conversationTitle = created.title ?? null;
    } else {
      const conversation = await this.store.requireConversation(
        params.userId,
        conversationId,
      );
      conversationTitle = conversation.title;
    }

    logServerDebug("kimi.chat-turn.start", {
      userId: params.userId,
      conversationId,
      agentId: params.agentId,
    });

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

    logServerDebug("kimi.chat-turn.context.ready", {
      conversationId,
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
      conversationId,
      agentId: params.agentId,
      content: reply.content,
      metadata,
    });

    await this.store.finalizeConversation({
      conversationId,
      currentTitle: conversationTitle,
      agentId: params.agentId,
      userMessage: params.content,
    });

    logServerDebug("kimi.chat-turn.success", {
      userId: params.userId,
      conversationId,
      agentId: params.agentId,
    });

    return {
      conversationId,
      id: String(assistantMessage.id),
      role: "assistant" as const,
      content: reply.content,
      agentId: params.agentId,
      createdAt: assistantMessage.createdAt.toISOString(),
      metadata,
    };
  }

  async retryLastUserTurn(params: {
    conversationId: number;
    agentId: string;
    userId: number;
  }) {
    const conversation = await this.store.requireConversation(
      params.userId,
      params.conversationId,
    );
    const lastMessage = await this.store.getLastMessage(params.conversationId);

    if (!lastMessage || lastMessage.role !== "user") {
      throw new Error("There is no pending user turn to retry.");
    }

    logServerDebug("kimi.chat-turn.retry.start", {
      userId: params.userId,
      conversationId: params.conversationId,
      agentId: params.agentId,
      lastMessageId: lastMessage.id,
    });

    const agent =
      AGENTS.find(candidate => candidate.id === params.agentId) ?? AGENTS[0];
    const recentMessages = await this.store.listRecentMessages(
      params.conversationId,
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

    const metadata = {
      engine: "kimi-mvp",
      providerSlug: "kimi",
      modelName: reply.model,
      finishReason: reply.finishReason,
      usage: reply.usage,
      retried: true,
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
      userMessage: lastMessage.content,
    });

    logServerDebug("kimi.chat-turn.retry.success", {
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

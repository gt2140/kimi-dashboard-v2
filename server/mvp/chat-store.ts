import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { conversations, messages } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";

export function buildConversationTitle(content: string) {
  const trimmed = content.trim();
  return trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
}

function parseMetadata(metadata: string | null) {
  if (!metadata) {
    return undefined;
  }

  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export class MvpChatStore {
  async listRecentMessages(conversationId: number, limit = 12) {
    const rows = await getDb()
      .select({
        role: messages.role,
        content: messages.content,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    return rows.reverse();
  }

  async requireConversation(userId: number, conversationId: number) {
    const rows = await getDb()
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          eq(conversations.id, conversationId),
        ),
      )
      .limit(1);

    const conversation = rows[0];
    if (!conversation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Conversation not found.",
      });
    }

    return conversation;
  }

  async listConversations(userId: number) {
    return getDb()
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(userId: number, conversationId: number) {
    const conversation = await this.requireConversation(userId, conversationId);
    const rows = await getDb()
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return {
      conversation,
      messages: rows.map(message => ({
        ...message,
        metadata: parseMetadata(message.metadata),
      })),
    };
  }

  async createConversation(params: {
    userId: number;
    agentId: string;
    title?: string;
  }) {
    const inserted = await getDb()
      .insert(conversations)
      .values({
        userId: params.userId,
        agentId: params.agentId,
        title: params.title || "New conversation",
        orchestrationMode: "single_agent",
      })
      .returning({ id: conversations.id });

    return inserted[0];
  }

  async deleteConversation(userId: number, conversationId: number) {
    await this.requireConversation(userId, conversationId);

    await getDb().transaction(async tx => {
      await tx.delete(messages).where(eq(messages.conversationId, conversationId));
      await tx.delete(conversations).where(eq(conversations.id, conversationId));
    });
  }

  async createUserMessage(params: {
    conversationId: number;
    agentId: string;
    content: string;
  }) {
    const inserted = await getDb()
      .insert(messages)
      .values({
        conversationId: params.conversationId,
        role: "user",
        kind: "user",
        content: params.content,
        agentId: params.agentId,
        metadata: JSON.stringify({ engine: "kimi-mvp" }),
      })
      .returning({ id: messages.id });

    return inserted[0];
  }

  async createAssistantMessage(params: {
    conversationId: number;
    agentId: string;
    content: string;
    metadata: Record<string, unknown>;
  }) {
    const inserted = await getDb()
      .insert(messages)
      .values({
        conversationId: params.conversationId,
        role: "assistant",
        kind: "assistant",
        content: params.content,
        agentId: params.agentId,
        metadata: JSON.stringify(params.metadata),
      })
      .returning({ id: messages.id, createdAt: messages.createdAt });

    return inserted[0];
  }

  async finalizeConversation(params: {
    conversationId: number;
    currentTitle: string | null;
    agentId: string;
    userMessage: string;
  }) {
    await getDb()
      .update(conversations)
      .set({
        agentId: params.agentId,
        title:
          params.currentTitle && params.currentTitle !== "New conversation"
            ? params.currentTitle
            : buildConversationTitle(params.userMessage),
        orchestrationMode: "single_agent",
        lastAgentRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, params.conversationId));
  }
}

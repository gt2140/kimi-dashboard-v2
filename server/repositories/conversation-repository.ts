import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { Conversation } from "../../db/schema.js";
import { conversations, messages } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";

export function buildConversationTitle(content: string) {
  const trimmed = content.trim();
  return trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
}

export class ConversationRepository {
  async requireConversationOwner(conversationId: number, userId: number) {
    const db = getDb();
    const rows = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, userId)
        )
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

  async createUserMessage(params: {
    conversationId: number;
    content: string;
    agentId: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = getDb();
    const inserted = await db
      .insert(messages)
      .values({
        conversationId: params.conversationId,
        role: "user",
        kind: "user",
        content: params.content,
        agentId: params.agentId,
        metadata: JSON.stringify(params.metadata ?? {}),
      })
      .returning({ id: messages.id, createdAt: messages.createdAt });

    const userMessage = inserted[0];
    if (!userMessage) {
      throw new Error("Failed to create the user message record.");
    }

    return userMessage;
  }

  async createAssistantMessage(params: {
    conversationId: number;
    content: string;
    agentId: string;
    metadata?: Record<string, unknown>;
  }) {
    const db = getDb();
    const inserted = await db
      .insert(messages)
      .values({
        conversationId: params.conversationId,
        role: "assistant",
        kind: "assistant",
        content: params.content,
        agentId: params.agentId,
        metadata: JSON.stringify(params.metadata ?? {}),
      })
      .returning({ id: messages.id, createdAt: messages.createdAt });

    const assistantMessage = inserted[0];
    if (!assistantMessage) {
      throw new Error("Failed to create the assistant message record.");
    }

    return assistantMessage;
  }

  async updateConversationAfterTurn(params: {
    conversation: Pick<Conversation, "id" | "title">;
    userMessage: string;
    agentId: string;
    orchestrationMode: "single_agent" | "primary_plus_supporting" | "review_loop";
  }) {
    const db = getDb();

    await db
      .update(conversations)
      .set({
        agentId: params.agentId,
        title:
          params.conversation.title === "New conversation" ||
          !params.conversation.title
            ? buildConversationTitle(params.userMessage)
            : params.conversation.title,
        orchestrationMode: params.orchestrationMode,
        lastAgentRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, params.conversation.id));
  }
}

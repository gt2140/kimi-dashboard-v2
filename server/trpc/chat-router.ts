import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { conversations, messages } from "../../db/schema.js";
import { logServerDebug, logServerError } from "../lib/debug.js";
import { getDb } from "../queries/connection.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { createRouter, authedQuery } from "./middleware.js";

export const chatSendMessageInputSchema = z.object({
  conversationId: z.number(),
  content: z.string().min(1),
  agentId: z.string(),
  calledAgentIds: z.array(z.string()).default([]),
});

export type ChatSendMessageInput = z.infer<typeof chatSendMessageInputSchema>;

const conversationRepository = new ConversationRepository();

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

export const chatRouter = createRouter({
  listConversations: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    try {
      const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, ctx.user.id))
        .orderBy(desc(conversations.updatedAt));

      logServerDebug("chat.listConversations", {
        userId: ctx.user.id,
        count: rows.length,
      });

      return rows.map(row => ({
        ...row,
        calledAgentIds: [],
      }));
    } catch (error) {
      logServerError("chat.listConversations.failed", error, {
        userId: ctx.user.id,
      });
      throw error;
    }
  }),

  getConversation: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conversation = await conversationRepository.requireConversationOwner(
        input.id,
        ctx.user.id
      );

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.id))
        .orderBy(messages.createdAt);

      const parsedMessages = rows.map(message => ({
        ...message,
        metadata: parseMetadata(message.metadata),
      }));

      logServerDebug("chat.getConversation", {
        conversationId: input.id,
        userId: ctx.user.id,
        messageCount: rows.length,
      });

      return {
        conversation: {
          ...conversation,
          calledAgentIds: [],
        },
        messages: parsedMessages,
      };
    }),

  createConversation: authedQuery
    .input(z.object({ agentId: z.string(), title: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      try {
        const result = await db
          .insert(conversations)
          .values({
            userId: ctx.user.id,
            agentId: input.agentId,
            title: input.title || "New conversation",
            orchestrationMode: "single_agent",
          })
          .returning({ id: conversations.id });

        logServerDebug("chat.createConversation", {
          userId: ctx.user.id,
          conversationId: result[0].id,
          agentId: input.agentId,
        });

        return { id: result[0].id };
      } catch (error) {
        logServerError("chat.createConversation.failed", error, {
          userId: ctx.user.id,
          agentId: input.agentId,
        });
        throw error;
      }
    }),

  deleteConversation: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await conversationRepository.requireConversationOwner(input.id, ctx.user.id);
      const db = getDb();

      await db.transaction(async tx => {
        await tx.delete(messages).where(eq(messages.conversationId, input.id));
        await tx.delete(conversations).where(eq(conversations.id, input.id));
      });
      logServerDebug("chat.deleteConversation", {
        userId: ctx.user.id,
        conversationId: input.id,
      });

      return { success: true };
    }),
});

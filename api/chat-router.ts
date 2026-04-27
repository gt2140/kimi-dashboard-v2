import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { conversations, messages } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const chatRouter = createRouter({
  listConversations: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, ctx.user.id))
      .orderBy(desc(conversations.updatedAt));
  }),

  getConversation: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const conv = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.id))
        .limit(1);

      if (!conv[0] || conv[0].userId !== ctx.user.id) {
        throw new Error("Conversation not found");
      }

      const msgs = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.id))
        .orderBy(messages.createdAt);

      return { conversation: conv[0], messages: msgs };
    }),

  createConversation: authedQuery
    .input(z.object({ agentId: z.string(), title: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.insert(conversations).values({
        userId: ctx.user.id,
        agentId: input.agentId,
        title: input.title || "New conversation",
      });
      return { id: Number(result[0].insertId) };
    }),

  sendMessage: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        content: z.string().min(1),
        agentId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conv = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);

      if (!conv[0] || conv[0].userId !== ctx.user.id) {
        throw new Error("Conversation not found");
      }

      await db.insert(messages).values({
        conversationId: input.conversationId,
        role: "user",
        content: input.content,
        agentId: input.agentId,
      });

      return { success: true };
    }),
});

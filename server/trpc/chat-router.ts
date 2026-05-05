import { z } from "zod";
import { MvpChatStore } from "../mvp/chat-store.js";
import { createRouter, authedQuery } from "./middleware.js";
import { MedicalResearchService } from "../services/medical-research.js";

export const chatSendMessageInputSchema = z.object({
  conversationId: z.number().optional(),
  content: z.string().min(1),
  agentId: z.string(),
});

export type ChatSendMessageInput = z.infer<typeof chatSendMessageInputSchema>;

const chatStore = new MvpChatStore();
const medicalResearchService = new MedicalResearchService();

export const chatRouter = createRouter({
  listConversations: authedQuery.query(async ({ ctx }) => {
    return chatStore.listConversations(ctx.user.id);
  }),

  getConversation: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const result = await chatStore.getConversation(ctx.user.id, input.id);
      return {
        conversation: result.conversation,
        messages: result.messages,
      };
    }),

  createConversation: authedQuery
    .input(z.object({ agentId: z.string(), title: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const created = await chatStore.createConversation({
        userId: ctx.user.id,
        agentId: input.agentId,
        title: input.title,
      });

      return { id: created.id };
    }),

  deleteConversation: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await chatStore.deleteConversation(ctx.user.id, input.id);
      return { success: true };
    }),

  medicalResearch: authedQuery
    .input(z.object({ query: z.string().min(3) }))
    .query(async ({ input }) => {
      const evidence = await medicalResearchService.search(input.query);
      return {
        query: input.query,
        evidence,
      };
    }),
});

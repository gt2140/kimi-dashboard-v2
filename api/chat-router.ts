import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  conversations,
  messages,
  type VaultFile as DbVaultFile,
  vaultFiles,
} from "@db/schema";
import { AGENTS } from "@/lib/data";
import { logServerDebug, logServerError } from "./lib/debug";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";

const chatMetadataSchema = z
  .object({
    calledAgents: z.array(z.string()).optional(),
    relatedVaultFiles: z.array(z.string()).optional(),
  })
  .optional();

function parseMetadata(metadata: string | null) {
  if (!metadata) {
    return undefined;
  }

  try {
    return JSON.parse(metadata) as z.infer<typeof chatMetadataSchema>;
  } catch {
    return undefined;
  }
}

function buildConversationTitle(content: string) {
  const trimmed = content.trim();
  return trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
}

async function buildAssistantReply(params: {
  userMessage: string;
  agentId: string;
  calledAgentIds: string[];
  userId: number;
}) {
  type VaultCategory = DbVaultFile["category"];
  const db = getDb();
  const selectedAgentIds = [params.agentId, ...params.calledAgentIds];
  const selectedAgents = AGENTS.filter(agent =>
    selectedAgentIds.includes(agent.id)
  );
  const allowedCategories = Array.from(
    new Set(selectedAgents.flatMap(agent => agent.allowedVaultCategories))
  ) as VaultCategory[];

  const accessibleFiles = allowedCategories.length
    ? await db
        .select({
          id: vaultFiles.id,
          filename: vaultFiles.filename,
          category: vaultFiles.category,
        })
        .from(vaultFiles)
        .where(
          and(
            eq(vaultFiles.userId, params.userId),
            inArray(vaultFiles.category, allowedCategories)
          )
        )
    : [];

  const agent = AGENTS.find(item => item.id === params.agentId);
  const supportingNames = params.calledAgentIds
    .map(id => AGENTS.find(agentItem => agentItem.id === id)?.name)
    .filter(Boolean) as string[];

  const accessibleSummary =
    accessibleFiles.length > 0
      ? accessibleFiles
          .slice(0, 3)
          .map(file => `${file.filename} (${file.category})`)
          .join(", ")
      : "No compatible vault files are linked yet for this conversation.";

  const sections = [
    `Primary agent: ${agent?.name ?? params.agentId}.`,
    supportingNames.length > 0
      ? `Supporting agents: ${supportingNames.join(", ")}.`
      : "No supporting agents were called in this turn.",
    `User request: ${params.userMessage}`,
    `Accessible vault context: ${accessibleSummary}`,
    accessibleFiles.length > 0
      ? "Next step: use the available vault files as evidence and expand this answer with real retrieval in the next phase."
      : "Next step: upload vault files so future answers can ground on user-specific context.",
  ];

  return {
    content: sections.join("\n\n"),
    relatedVaultFiles: accessibleFiles.map(file => file.filename),
  };
}

async function requireConversationOwner(
  conversationId: number,
  userId: number
) {
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
        calledAgentIds: [] as string[],
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
      const conversation = await requireConversationOwner(
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
      const lastMessageWithAgents = [...parsedMessages]
        .reverse()
        .find(message => message.metadata?.calledAgents?.length);

      logServerDebug("chat.getConversation", {
        conversationId: input.id,
        userId: ctx.user.id,
        messageCount: rows.length,
      });

      return {
        conversation: {
          ...conversation,
          calledAgentIds: lastMessageWithAgents?.metadata?.calledAgents ?? [],
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

  sendMessage: authedQuery
    .input(
      z.object({
        conversationId: z.number(),
        content: z.string().min(1),
        agentId: z.string(),
        calledAgentIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const conversation = await requireConversationOwner(
        input.conversationId,
        ctx.user.id
      );

      try {
        const userMetadata = {
          calledAgents:
            input.calledAgentIds.length > 0 ? input.calledAgentIds : undefined,
        };
        const assistantReply = await buildAssistantReply({
          userMessage: input.content,
          agentId: input.agentId,
          calledAgentIds: input.calledAgentIds,
          userId: ctx.user.id,
        });
        await db.transaction(async tx => {
          await tx.insert(messages).values({
            conversationId: input.conversationId,
            role: "user",
            content: input.content,
            agentId: input.agentId,
            metadata: JSON.stringify(userMetadata),
          });

          await tx.insert(messages).values({
            conversationId: input.conversationId,
            role: "assistant",
            content: assistantReply.content,
            agentId: input.agentId,
            metadata: JSON.stringify({
              calledAgents:
                input.calledAgentIds.length > 0
                  ? input.calledAgentIds
                  : undefined,
              relatedVaultFiles: assistantReply.relatedVaultFiles,
            }),
          });

          await tx
            .update(conversations)
            .set({
              title:
                conversation.title === "New conversation" || !conversation.title
                  ? buildConversationTitle(input.content)
                  : conversation.title,
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, input.conversationId));
        });

        logServerDebug("chat.sendMessage", {
          userId: ctx.user.id,
          conversationId: input.conversationId,
          agentId: input.agentId,
        });

        return { success: true };
      } catch (error) {
        logServerError("chat.sendMessage.failed", error, {
          userId: ctx.user.id,
          conversationId: input.conversationId,
          agentId: input.agentId,
        });
        throw error;
      }
    }),

  deleteConversation: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireConversationOwner(input.id, ctx.user.id);
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

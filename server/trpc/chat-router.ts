import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  agentDefinitions,
  agentRuns,
  conversationAgents,
  conversations,
  messageContextBlocks,
  messages,
} from "../../db/schema.js";
import { logServerDebug, logServerError } from "../lib/debug.js";
import { getDb } from "../queries/connection.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import {
  type ChatTurnStage,
  generatePrimaryReply,
} from "../services/chat-reply-builder.js";
import { syncConversationParticipants } from "../services/conversation-participants.js";
import { auraChatConversationTurnRuntime } from "../services/kimi-runtime.js";
import { ModelGatewayService } from "../services/model-gateway.js";
import { createRouter, authedQuery } from "./middleware.js";

export { generatePrimaryReply };

export const chatSendMessageInputSchema = z.object({
  conversationId: z.number(),
  content: z.string().min(1),
  agentId: z.string(),
  requestedModelName: z.string().optional(),
});

export type ChatSendMessageInput = z.infer<typeof chatSendMessageInputSchema>;

const chatMetadataSchema = z
  .object({
    calledAgents: z.array(z.string()).optional(),
    relatedVaultFiles: z.array(z.string()).optional(),
    orchestrationMode: z.string().optional(),
    note: z.string().optional(),
    responseMode: z.enum(["model", "limited"]).optional(),
    consultedAgentNames: z.array(z.string()).optional(),
    consultationMode: z.enum(["none", "explicit", "auto"]).optional(),
    consultationReason: z.string().optional(),
    contextSummary: z.string().optional(),
    missingContext: z.array(z.string()).optional(),
    executionNotes: z.array(z.string()).optional(),
    providerSlug: z.string().optional(),
    modelName: z.string().optional(),
    requestedModelName: z.string().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    runtimeVersion: z.enum(["classic", "aura-medical-v1"]).optional(),
    medicalMode: z.enum(["personal-health", "research"]).optional(),
    policyLevel: z.enum(["interpretive-on-request"]).optional(),
    reasoningProfile: z.string().optional(),
    researchEvidence: z
      .array(
        z.object({
          source: z.enum(["pubmed", "clinicaltrials"]),
          title: z.string(),
          url: z.string(),
          citation: z.string().optional(),
        })
      )
      .optional(),
  })
  .optional();

const conversationRepository = new ConversationRepository();
const modelGatewayService = new ModelGatewayService();

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

export async function sendChatMessage(params: {
  input: ChatSendMessageInput;
  userId: number;
  streamPrimary?: boolean;
  onStage?: (stage: ChatTurnStage) => void | Promise<void>;
  onTextDelta?: (delta: string) => void | Promise<void>;
  traceContext?: {
    requestId: string;
    route: string;
  };
}) {
  return auraChatConversationTurnRuntime.executeTurn({
    userId: params.userId,
    conversationId: params.input.conversationId,
    content: params.input.content,
    agentId: params.input.agentId,
    requestedModelName: params.input.requestedModelName,
    stream: Boolean(params.streamPrimary),
    onStage: params.onStage,
    onTextDelta: params.onTextDelta,
  });
}

export const chatRouter = createRouter({
  listAvailableModels: authedQuery.query(async () => {
    const veniceModels = await modelGatewayService.listVeniceTextModels();

    return [
      {
        providerSlug: "auto" as const,
        modelName: null,
        displayName: "Auto",
        providerLabel: "Aura",
        modelId: null,
        contextWindow: "Default",
        badges: ["Recommended"],
        supportsReasoning: true,
        supportsVision: false,
        supportsCode: false,
        isDefaultCandidate: true,
      },
      ...veniceModels,
    ];
  }),

  listConversations: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    try {
      const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, ctx.user.id))
        .orderBy(desc(conversations.updatedAt));

      const participants =
        rows.length > 0
          ? await db
              .select({
                conversationId: conversationAgents.conversationId,
                role: conversationAgents.role,
                isActive: conversationAgents.isActive,
                agentSlug: agentDefinitions.slug,
              })
              .from(conversationAgents)
              .innerJoin(
                agentDefinitions,
                eq(conversationAgents.agentDefinitionId, agentDefinitions.id)
              )
              .where(
                inArray(
                  conversationAgents.conversationId,
                  rows.map(row => row.id)
                )
              )
          : [];

      logServerDebug("chat.listConversations", {
        userId: ctx.user.id,
        count: rows.length,
      });

      return rows.map(row => ({
        ...row,
        calledAgentIds: participants
          .filter(
            participant =>
              participant.conversationId === row.id &&
              participant.role === "supporting" &&
              participant.isActive
          )
          .map(participant => participant.agentSlug),
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
      const conversation =
        await conversationRepository.requireConversationOwner(
          input.id,
          ctx.user.id
        );

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.id))
        .orderBy(messages.createdAt);

      const participants = await db
        .select({
          role: conversationAgents.role,
          isActive: conversationAgents.isActive,
          agentSlug: agentDefinitions.slug,
        })
        .from(conversationAgents)
        .innerJoin(
          agentDefinitions,
          eq(conversationAgents.agentDefinitionId, agentDefinitions.id)
        )
        .where(eq(conversationAgents.conversationId, input.id));

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
          calledAgentIds: participants
            .filter(
              participant =>
                participant.role === "supporting" && participant.isActive
            )
            .map(participant => participant.agentSlug),
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

        await syncConversationParticipants({
          conversationId: result[0].id,
          primaryAgentSlug: input.agentId,
          supportingAgentSlugs: [],
        });

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
    .input(chatSendMessageInputSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        return await sendChatMessage({
          input,
          userId: ctx.user.id,
        });
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
      await conversationRepository.requireConversationOwner(
        input.id,
        ctx.user.id
      );
      const db = getDb();

      await db.transaction(async tx => {
        await tx.delete(messages).where(eq(messages.conversationId, input.id));
        await tx
          .delete(conversationAgents)
          .where(eq(conversationAgents.conversationId, input.id));
        await tx
          .delete(messageContextBlocks)
          .where(eq(messageContextBlocks.conversationId, input.id));
        await tx
          .delete(agentRuns)
          .where(eq(agentRuns.conversationId, input.id));
        await tx.delete(conversations).where(eq(conversations.id, input.id));
      });
      logServerDebug("chat.deleteConversation", {
        userId: ctx.user.id,
        conversationId: input.id,
      });

      return { success: true };
    }),
});

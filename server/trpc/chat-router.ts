import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  agentDefinitions,
  agentRuns,
  conversationAgents,
  conversations,
  messageContextBlocks,
  messages,
  modelEndpoints,
  modelProviders,
} from "../../db/schema.js";
import { logServerDebug, logServerError } from "../lib/debug.js";
import { createRouter, authedQuery } from "./middleware.js";
import { getDb } from "../queries/connection.js";
import {
  ensureConversationalCatalogSeeded,
  getActiveSystemPrompt,
  getAgentDefinitionBySlug,
} from "../queries/agents.js";
import { resolveConsultationPlan } from "../services/consultation-policy.js";
import { ModelGatewayService } from "../services/model-gateway.js";
import { planConversationTurn } from "../services/conversation-orchestrator.js";
import { buildContextAwareFallbackReply } from "../services/fallback-reply.js";
import {
  buildPrimarySystemPrompt,
  buildSupportingSystemPrompt,
} from "../services/prompt-composer.js";

const chatMetadataSchema = z
  .object({
    calledAgents: z.array(z.string()).optional(),
    relatedVaultFiles: z.array(z.string()).optional(),
    orchestrationMode: z.string().optional(),
    note: z.string().optional(),
    responseMode: z.enum(["model", "limited"]).optional(),
    consultedAgentNames: z.array(z.string()).optional(),
    providerSlug: z.string().optional(),
    modelName: z.string().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
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

async function syncConversationParticipants(params: {
  conversationId: number;
  primaryAgentSlug: string;
  supportingAgentSlugs: string[];
}) {
  await ensureConversationalCatalogSeeded();
  const db = getDb();
  const slugs = [params.primaryAgentSlug, ...params.supportingAgentSlugs];
  const definitions = await db
    .select()
    .from(agentDefinitions)
    .where(inArray(agentDefinitions.slug, slugs));

  const bySlug = new Map(
    definitions.map(definition => [definition.slug, definition] as const)
  );

  const primary = bySlug.get(params.primaryAgentSlug);
  if (!primary) {
    throw new Error(`Primary agent ${params.primaryAgentSlug} was not found`);
  }

  const activeSupportingIds = params.supportingAgentSlugs
    .map(slug => bySlug.get(slug)?.id)
    .filter((value): value is number => Boolean(value));

  await db
    .insert(conversationAgents)
    .values({
      conversationId: params.conversationId,
      agentDefinitionId: primary.id,
      role: "primary",
      addedByUser: true,
      position: 0,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [
        conversationAgents.conversationId,
        conversationAgents.agentDefinitionId,
        conversationAgents.role,
      ],
      set: {
        addedByUser: true,
        position: 0,
        isActive: true,
      },
    });

  await db
    .update(conversationAgents)
    .set({ isActive: false })
    .where(
      and(
        eq(conversationAgents.conversationId, params.conversationId),
        eq(conversationAgents.role, "supporting")
      )
    );

  for (const [index, slug] of params.supportingAgentSlugs.entries()) {
    const supporting = bySlug.get(slug);
    if (!supporting) {
      continue;
    }

    await db
      .insert(conversationAgents)
      .values({
        conversationId: params.conversationId,
        agentDefinitionId: supporting.id,
        role: "supporting",
        addedByUser: true,
        position: index + 1,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [
          conversationAgents.conversationId,
          conversationAgents.agentDefinitionId,
          conversationAgents.role,
        ],
        set: {
          addedByUser: true,
          position: index + 1,
          isActive: true,
        },
      });
  }

  if (activeSupportingIds.length > 0) {
    await db
      .update(conversationAgents)
      .set({ isActive: true })
      .where(
        and(
          eq(conversationAgents.conversationId, params.conversationId),
          eq(conversationAgents.role, "supporting"),
          inArray(conversationAgents.agentDefinitionId, activeSupportingIds)
        )
      );
  }

  return {
    primary,
    supporting: params.supportingAgentSlugs
      .map(slug => bySlug.get(slug))
      .filter(Boolean),
  };
}

async function buildAssistantReply(params: {
  userMessage: string;
  agentId: string;
  availableSupportingAgentIds: string[];
  userId: number;
  conversationId: number;
}) {
  const consultationPlan = resolveConsultationPlan({
    primaryAgentSlug: params.agentId,
    availableSupportingAgentSlugs: params.availableSupportingAgentIds,
    userMessage: params.userMessage,
  });

  const orchestrationPlan = await planConversationTurn({
    userId: params.userId,
    conversationId: params.conversationId,
    primaryAgentSlug: params.agentId,
    supportingAgentSlugs: consultationPlan.consultedAgentSlugs,
    latestUserMessage: params.userMessage,
  });

  const primaryDefinition = await getAgentDefinitionBySlug(params.agentId);
  const primaryPrompt = primaryDefinition
    ? await getActiveSystemPrompt(primaryDefinition.id)
    : null;
  const supportingDefinitions = await Promise.all(
    consultationPlan.consultedAgentSlugs.map(slug =>
      getAgentDefinitionBySlug(slug)
    )
  );

  const accessibleFiles = orchestrationPlan.primaryContext.accessibleFiles;
  const supportingNames = supportingDefinitions
    .filter(Boolean)
    .map(agent => agent!.name);

  const accessibleSummary =
    accessibleFiles.length > 0
      ? accessibleFiles
          .slice(0, 4)
          .map(file => `${file.filename} (${file.category})`)
          .join(", ")
      : "No compatible vault files are linked yet for this conversation.";

  const recentSummary =
    orchestrationPlan.primaryContext.recentMessages.length > 0
      ? orchestrationPlan.primaryContext.recentMessages
          .slice(-3)
          .map(message => `${message.role}: ${message.content}`)
          .join(" | ")
      : "No prior message history.";

  const sections = [
    `Primary agent: ${primaryDefinition?.name ?? params.agentId}.`,
    supportingNames.length > 0
      ? `Supporting agents consulted: ${supportingNames.join(", ")}.`
      : "No supporting agents were consulted in this turn.",
    `Conversation mode: ${orchestrationPlan.orchestrationMode}.`,
    `User request: ${params.userMessage}`,
    `Recent conversation context: ${recentSummary}`,
    `Accessible vault context: ${accessibleSummary}`,
    orchestrationPlan.primaryContext.resolvedAgentProfile.customContext
      ? `User-specific agent context: ${orchestrationPlan.primaryContext.resolvedAgentProfile.customContext}`
      : "User-specific agent context: none configured yet.",
    orchestrationPlan.primaryContext.resolvedAgentProfile.trainingNotes
      ? `Training notes: ${orchestrationPlan.primaryContext.resolvedAgentProfile.trainingNotes}`
      : "Training notes: none configured yet.",
    supportingNames.length > 0
      ? "Specialist consultation is active for this turn. If a model call fails, this preview becomes the fallback instead of breaking the chat."
      : "The primary agent answers directly on the fast path. If the model call fails, this preview becomes the fallback instead of breaking the chat.",
  ];

  const previewContent = sections.join("\n\n");
  const gateway = new ModelGatewayService();
  const supportingRuns = await Promise.all(
    orchestrationPlan.supportingContexts.map(async ({ agentSlug, context }) => {
      const definition =
        supportingDefinitions.find(agent => agent?.slug === agentSlug) ?? null;
      const prompt = definition
        ? await getActiveSystemPrompt(definition.id)
        : null;
      const supportingRecentSummary =
        context.recentMessages.length > 0
          ? context.recentMessages
              .slice(-3)
              .map(message => `${message.role}: ${message.content}`)
              .join(" | ")
          : "No prior message history.";
      const supportingAccessibleSummary =
        context.accessibleFiles.length > 0
          ? context.accessibleFiles
              .slice(0, 4)
              .map(file => `${file.filename} (${file.category})`)
              .join(", ")
          : "No compatible vault files are linked yet for this conversation.";

      try {
        const generation = await gateway.generateText({
          providerSlug: "openai",
          systemPrompt: buildSupportingSystemPrompt({
            agentName: definition?.name ?? agentSlug,
            basePrompt:
              prompt?.templateText ??
              `You are ${definition?.name ?? agentSlug}. Provide concise specialist support to the primary agent.`,
            responseStyle: context.resolvedAgentProfile.responseStyle,
          }),
          messages: [
            {
              role: "user",
              content: [
                `User request: ${params.userMessage}`,
                `Recent conversation context: ${supportingRecentSummary}`,
                `Accessible vault context: ${supportingAccessibleSummary}`,
                context.resolvedAgentProfile.customContext
                  ? `User-specific instructions: ${context.resolvedAgentProfile.customContext}`
                  : "User-specific instructions: none configured yet.",
                context.resolvedAgentProfile.trainingNotes
                  ? `Training notes: ${context.resolvedAgentProfile.trainingNotes}`
                  : "Training notes: none configured yet.",
                "Return a short specialist consultation for the primary agent. Mention uncertainty instead of inventing facts.",
              ].join("\n\n"),
            },
          ],
        });

        return {
          agentSlug,
          agentDefinitionId: definition?.id ?? null,
          agentName: definition?.name ?? agentSlug,
          content: generation.text,
          status: "completed" as const,
          providerSlug: generation.providerSlug,
          modelName: generation.modelName,
          inputTokens: generation.inputTokens,
          outputTokens: generation.outputTokens,
          errorMessage: null,
        };
      } catch (error) {
        logServerError("chat.supporting-agent.fallback", error, {
          conversationId: params.conversationId,
          agentSlug,
        });

        return {
          agentSlug,
          agentDefinitionId: definition?.id ?? null,
          agentName: definition?.name ?? agentSlug,
          content: `Supporting consultation planned for ${definition?.name ?? agentSlug}, but the model call failed and the run fell back to preview mode.`,
          status: "failed" as const,
          providerSlug: "openai",
          modelName: "fallback-preview",
          inputTokens: undefined,
          outputTokens: undefined,
          errorMessage:
            error instanceof Error ? error.message : "Supporting model call failed.",
        };
      }
    })
  );

  const supportingSummary =
    supportingRuns.length > 0
      ? supportingRuns
          .map(
            run =>
              `${run.agentName}: ${run.content}${run.status === "failed" ? " [fallback]" : ""}`
          )
          .join("\n\n")
      : "No supporting specialists consulted in this turn.";

  const modelMessages = [
    {
      role: "user" as const,
      content: [
        `User request: ${params.userMessage}`,
        `Recent conversation context: ${recentSummary}`,
        `Accessible vault context: ${accessibleSummary}`,
        orchestrationPlan.primaryContext.resolvedAgentProfile.customContext
          ? `User-specific instructions: ${orchestrationPlan.primaryContext.resolvedAgentProfile.customContext}`
          : "User-specific instructions: none configured yet.",
        orchestrationPlan.primaryContext.resolvedAgentProfile.trainingNotes
          ? `Training notes: ${orchestrationPlan.primaryContext.resolvedAgentProfile.trainingNotes}`
          : "Training notes: none configured yet.",
        `Supporting specialist notes:\n${supportingSummary}`,
        "Produce a helpful user-facing answer. If context is missing, say what is missing without inventing facts.",
      ].join("\n\n"),
    },
  ];

  try {
    const generation = await gateway.generateText({
      providerSlug: "openai",
      systemPrompt: buildPrimarySystemPrompt({
        agentName: primaryDefinition?.name ?? params.agentId,
        basePrompt:
          primaryPrompt?.templateText ??
          `You are ${primaryDefinition?.name ?? params.agentId}. Answer helpfully and clearly.`,
        responseStyle:
          orchestrationPlan.primaryContext.resolvedAgentProfile.responseStyle,
        canConsultSpecialists: consultationPlan.consultedAgentSlugs.length > 0,
      }),
      messages: modelMessages,
    });

    return {
      content: generation.text,
      relatedVaultFiles: accessibleFiles.map(file => file.filename),
      orchestrationMode: orchestrationPlan.orchestrationMode,
      consultedAgentSlugs: consultationPlan.consultedAgentSlugs,
      supportingAgentNames: supportingNames,
      supportingRuns,
      note:
        accessibleFiles.length === 0 &&
        orchestrationPlan.primaryContext.resolvedAgentProfile.allowVaultContext
          ? "Podes subir estudios o notas al vault para personalizar mejor la respuesta."
          : null,
      primaryRun: {
        providerSlug: generation.providerSlug,
        modelName: generation.modelName,
        inputTokens: generation.inputTokens,
        outputTokens: generation.outputTokens,
        errorMessage: null,
        usedFallback: false,
      },
      responseMode: "model" as const,
    };
  } catch (error) {
    logServerError("chat.model-gateway.fallback", error, {
      conversationId: params.conversationId,
      agentId: params.agentId,
    });
  }

  const gracefulFallback = buildContextAwareFallbackReply({
    userMessage: params.userMessage,
    agentName: primaryDefinition?.name ?? params.agentId,
    allowedCategories:
      orchestrationPlan.primaryContext.resolvedAgentProfile.allowedVaultCategories,
    accessibleFileCount: accessibleFiles.length,
  });

  return {
    content: gracefulFallback.content,
    relatedVaultFiles: accessibleFiles.map(file => file.filename),
    orchestrationMode: orchestrationPlan.orchestrationMode,
    consultedAgentSlugs: consultationPlan.consultedAgentSlugs,
    supportingAgentNames: supportingNames,
    supportingRuns,
    note: gracefulFallback.note,
    primaryRun: {
      providerSlug: "openai",
      modelName: "fallback-preview",
      inputTokens: undefined,
      outputTokens: undefined,
      errorMessage: previewContent,
      usedFallback: true,
    },
    responseMode: "limited" as const,
  };
}

async function resolveModelReference(providerSlug: string, modelName: string) {
  const db = getDb();
  const providerRows = await db
    .select({ id: modelProviders.id })
    .from(modelProviders)
    .where(eq(modelProviders.slug, providerSlug))
    .limit(1);

  const providerId = providerRows[0]?.id ?? null;
  if (!providerId) {
    return {
      providerId: null,
      modelEndpointId: null,
    };
  }

  const endpointRows = await db
    .select({ id: modelEndpoints.id })
    .from(modelEndpoints)
    .where(
      and(
        eq(modelEndpoints.providerId, providerId),
        eq(modelEndpoints.modelName, modelName)
      )
    )
    .limit(1);

  if (!endpointRows[0]) {
    const fallbackEndpointRows = await db
      .select({ id: modelEndpoints.id })
      .from(modelEndpoints)
      .where(eq(modelEndpoints.providerId, providerId))
      .limit(1);

    return {
      providerId,
      modelEndpointId: fallbackEndpointRows[0]?.id ?? null,
    };
  }

  return {
    providerId,
    modelEndpointId: endpointRows[0]?.id ?? null,
  };
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
      const conversation = await requireConversationOwner(
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
              participant => participant.role === "supporting" && participant.isActive
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
        const participants = await syncConversationParticipants({
          conversationId: input.conversationId,
          primaryAgentSlug: input.agentId,
          supportingAgentSlugs: input.calledAgentIds,
        });

        const userMetadata = {
          calledAgents:
            input.calledAgentIds.length > 0 ? input.calledAgentIds : undefined,
        };
        const assistantReply = await buildAssistantReply({
          userMessage: input.content,
          agentId: input.agentId,
          availableSupportingAgentIds: input.calledAgentIds,
          userId: ctx.user.id,
          conversationId: input.conversationId,
        });
        const primaryModelReference = await resolveModelReference(
          assistantReply.primaryRun.providerSlug,
          assistantReply.primaryRun.modelName
        );
        const supportingModelReferences = await Promise.all(
          assistantReply.supportingRuns.map(run =>
            resolveModelReference(run.providerSlug, run.modelName)
          )
        );

        await db.transaction(async tx => {
          const insertedUserMessage = await tx
            .insert(messages)
            .values({
              conversationId: input.conversationId,
              role: "user",
              kind: "user",
              content: input.content,
              agentId: input.agentId,
              metadata: JSON.stringify(userMetadata),
            })
            .returning({ id: messages.id });

          const userMessageId = insertedUserMessage[0]?.id;
          if (userMessageId == null) {
            throw new Error("Failed to create the user message record.");
          }

          const insertedAssistantMessage = await tx
            .insert(messages)
            .values({
              conversationId: input.conversationId,
              role: "assistant",
              kind: "assistant",
              content: assistantReply.content,
              agentId: input.agentId,
              metadata: JSON.stringify({
                calledAgents:
                  assistantReply.consultedAgentSlugs.length > 0
                    ? assistantReply.consultedAgentSlugs
                    : undefined,
                relatedVaultFiles: assistantReply.relatedVaultFiles,
                orchestrationMode: assistantReply.orchestrationMode,
                note:
                  assistantReply.note ??
                  (assistantReply.responseMode === "limited"
                    ? "OpenAI no respondio correctamente y esta respuesta salio en modo fallback."
                    : "OpenAI respondio en vivo."),
                responseMode: assistantReply.responseMode,
                consultedAgentNames:
                  assistantReply.supportingAgentNames.length > 0
                    ? assistantReply.supportingAgentNames
                    : undefined,
                providerSlug: assistantReply.primaryRun.providerSlug,
                modelName: assistantReply.primaryRun.modelName,
                inputTokens: assistantReply.primaryRun.inputTokens,
                outputTokens: assistantReply.primaryRun.outputTokens,
              }),
            })
            .returning({ id: messages.id });

          const assistantMessageId = insertedAssistantMessage[0]?.id;
          if (assistantMessageId == null) {
            throw new Error("Failed to create the assistant message record.");
          }

          const primaryRun = await tx
            .insert(agentRuns)
            .values({
              conversationId: input.conversationId,
              messageId: assistantMessageId,
              agentDefinitionId: participants.primary.id,
              runType: "primary_reply",
              providerId: primaryModelReference.providerId,
              modelEndpointId: primaryModelReference.modelEndpointId,
              status: assistantReply.primaryRun.usedFallback ? "failed" : "completed",
              resolvedUserContext: input.content,
              outputText: assistantReply.content,
              inputTokens: assistantReply.primaryRun.inputTokens,
              outputTokens: assistantReply.primaryRun.outputTokens,
              errorMessage: assistantReply.primaryRun.errorMessage,
              completedAt: new Date(),
            })
            .returning({ id: agentRuns.id });

          const primaryRunId = primaryRun[0]?.id;
          if (primaryRunId == null) {
            throw new Error("Failed to persist the primary agent run.");
          }

          for (const [index, supportingRun] of assistantReply.supportingRuns.entries()) {
            if (!supportingRun?.agentDefinitionId) {
              continue;
            }

            await tx.insert(agentRuns).values({
              conversationId: input.conversationId,
              messageId: userMessageId,
              agentDefinitionId: supportingRun.agentDefinitionId,
              runType: "supporting_consult",
              providerId: supportingModelReferences[index]?.providerId ?? null,
              modelEndpointId:
                supportingModelReferences[index]?.modelEndpointId ?? null,
              status: supportingRun?.status ?? "failed",
              resolvedUserContext: input.content,
              outputText:
                supportingRun?.content ??
                `Supporting consultation planned for ${supportingRun?.agentName ?? "specialist"}.`,
              inputTokens: supportingRun?.inputTokens,
              outputTokens: supportingRun?.outputTokens,
              errorMessage:
                supportingRun?.errorMessage ??
                "Supporting run result was not available.",
              completedAt: new Date(),
            });
          }

          for (const filename of assistantReply.relatedVaultFiles) {
            await tx.insert(messageContextBlocks).values({
              conversationId: input.conversationId,
              messageId: assistantMessageId,
              agentRunId: primaryRunId,
              sourceType: "vault_file",
              sourceId: filename,
              title: filename,
              content: `Vault file available to the run: ${filename}`,
              metadata: {
                relation: "accessible_vault_file",
              },
            });
          }

          await tx
            .update(conversations)
            .set({
              agentId: input.agentId,
              title:
                conversation.title === "New conversation" || !conversation.title
                  ? buildConversationTitle(input.content)
                  : conversation.title,
              orchestrationMode: assistantReply.orchestrationMode as
                | "single_agent"
                | "primary_plus_supporting"
                | "review_loop",
              lastAgentRunAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(conversations.id, input.conversationId));
        });

        logServerDebug("chat.sendMessage", {
          userId: ctx.user.id,
          conversationId: input.conversationId,
          agentId: input.agentId,
          supportingAgentCount: input.calledAgentIds.length,
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
        await tx
          .delete(conversationAgents)
          .where(eq(conversationAgents.conversationId, input.id));
        await tx
          .delete(messageContextBlocks)
          .where(eq(messageContextBlocks.conversationId, input.id));
        await tx.delete(agentRuns).where(eq(agentRuns.conversationId, input.id));
        await tx.delete(conversations).where(eq(conversations.id, input.id));
      });
      logServerDebug("chat.deleteConversation", {
        userId: ctx.user.id,
        conversationId: input.id,
      });

      return { success: true };
    }),
});

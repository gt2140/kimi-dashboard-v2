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
import { resolveExecutionTarget } from "../services/execution-target.js";
import { ModelGatewayService } from "../services/model-gateway.js";
import { planConversationTurn } from "../services/conversation-orchestrator.js";
import { buildContextAwareFallbackReply } from "../services/fallback-reply.js";
import {
  buildOperationalFallbackNote,
  extractOperationalFailureReason,
} from "../services/chat-fallback.js";
import {
  buildPrimarySystemPrompt,
  buildSupportingSystemPrompt,
} from "../services/prompt-composer.js";
import {
  buildContextSummary,
  collectMissingContext,
  formatPromptContext,
} from "../services/context-prompt.js";
import { withTimeout } from "../services/async-guard.js";
import { withAbortableTimeout } from "../services/async-guard.js";
import {
  buildPendingTurnStages,
  splitMessageForReveal,
} from "../../src/lib/chat-experience.js";

type ChatTurnStage = {
  id: string;
  label: string;
};

type ChatTurnStreamHandlers = {
  onStage?: (stage: ChatTurnStage) => void | Promise<void>;
  onTextDelta?: (delta: string) => void | Promise<void>;
  streamPrimary?: boolean;
};

export async function generatePrimaryReply(params: {
  gateway: Pick<ModelGatewayService, "generateText" | "streamText">;
  providerSlug: string;
  modelName: string | null;
  systemPrompt: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  signal?: AbortSignal | null;
  streamPrimary?: boolean;
  onTextDelta?: (delta: string) => void | Promise<void>;
}) {
  if (params.streamPrimary) {
    return params.gateway.streamText({
      providerSlug: params.providerSlug,
      modelName: params.modelName,
      systemPrompt: params.systemPrompt,
      signal: params.signal,
      messages: params.messages,
      onTextDelta: params.onTextDelta,
    });
  }

  return params.gateway.generateText({
    providerSlug: params.providerSlug,
    modelName: params.modelName,
    systemPrompt: params.systemPrompt,
    signal: params.signal,
    messages: params.messages,
  });
}

const SUPPORTING_AGENT_TIMEOUT_MS = 15_000;
const PRIMARY_AGENT_TIMEOUT_MS = 25_000;
const TURN_SETUP_TIMEOUT_MS = 10_000;

export const chatSendMessageInputSchema = z.object({
  conversationId: z.number(),
  content: z.string().min(1),
  agentId: z.string(),
  calledAgentIds: z.array(z.string()).default([]),
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
    requestedProviderSlug: z.string().optional(),
    requestedModelName: z.string().optional(),
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
} & ChatTurnStreamHandlers) {
  const consultationPlan = resolveConsultationPlan({
    primaryAgentSlug: params.agentId,
    availableSupportingAgentSlugs: params.availableSupportingAgentIds,
    userMessage: params.userMessage,
  });
  const stagePlan = buildPendingTurnStages({
    primaryAgentId: params.agentId,
    helperAgentIds: consultationPlan.consultedAgentSlugs,
    userMessage: params.userMessage,
  });
  const emittedStages = new Set<string>();
  const emitStage = async (stageId: string) => {
    const stage = stagePlan.find(item => item.id === stageId);
    if (!stage || emittedStages.has(stage.id)) {
      return;
    }

    emittedStages.add(stage.id);
    await params.onStage?.(stage);
  };

  await emitStage("analyze");

  const defaultFallbackExecutionTarget = {
    requestedProviderSlug: null,
    requestedModelName: null,
    providerSlug: "openai",
    modelName: "fallback-preview",
    executionNotes: [] as string[],
    usedFallback: true,
  };

  const buildLimitedTurnReply = async (input: {
    note: string;
    executionNotes?: string[];
    consultationMode?: "none" | "explicit" | "auto";
    consultationReason?: string | null;
    operationalFailureReason?: string | null;
  }) => {
    const gracefulFallback = buildContextAwareFallbackReply({
      userMessage: params.userMessage,
      agentName: "Generalist",
      allowedCategories: [],
      accessibleFileCount: 0,
    });
    const primarySystemPrompt = buildPrimarySystemPrompt({
      agentSlug: params.agentId,
      agentName: "Generalist",
      basePrompt: "You are Generalist. Answer helpfully and clearly.",
      responseStyle: "detailed",
      canConsultSpecialists: consultationPlan.consultedAgentSlugs.length > 0,
    });

    if (params.streamPrimary) {
      for (const chunk of splitMessageForReveal(gracefulFallback.content)) {
        await params.onTextDelta?.(chunk);
      }
    }

    return {
      content: gracefulFallback.content,
      relatedVaultFiles: [],
      orchestrationMode: "single_agent" as const,
      consultedAgentSlugs: consultationPlan.consultedAgentSlugs,
      supportingAgentNames: [],
      consultationMode: input.consultationMode ?? consultationPlan.mode,
      consultationReason: input.consultationReason ?? consultationPlan.rationale,
      contextSummary:
        "Aura could not finish assembling the full turn context in time.",
      missingContext: ["Full turn context was not available in time."],
      executionNotes: [
        ...defaultFallbackExecutionTarget.executionNotes,
        ...(input.executionNotes ?? []),
      ],
      supportingRuns: [],
      operationalFailureReason: input.operationalFailureReason ?? null,
      note: buildOperationalFallbackNote({
        operationalFailureReason: input.operationalFailureReason ?? null,
        fallbackReplyNote: gracefulFallback.note ?? input.note,
      }),
      primaryRun: {
        providerSlug: defaultFallbackExecutionTarget.providerSlug,
        modelName: defaultFallbackExecutionTarget.modelName,
        requestedProviderSlug:
          defaultFallbackExecutionTarget.requestedProviderSlug,
        requestedModelName: defaultFallbackExecutionTarget.requestedModelName,
        executionNotes: [
          ...defaultFallbackExecutionTarget.executionNotes,
          ...(input.executionNotes ?? []),
        ],
        systemPrompt: primarySystemPrompt,
        inputMessages: [
          {
            role: "user" as const,
            content: params.userMessage,
          },
        ],
        inputTokens: undefined,
        outputTokens: undefined,
        errorMessage: input.operationalFailureReason ?? input.note,
        usedFallback: true,
      },
      responseMode: "limited" as const,
    };
  };

  let primaryDefinition:
    | Awaited<ReturnType<typeof getAgentDefinitionBySlug>>
    | null = null;
  let primaryPrompt:
    | Awaited<ReturnType<typeof getActiveSystemPrompt>>
    | null = null;
  let orchestrationPlan: Awaited<ReturnType<typeof planConversationTurn>>;
  let primaryExecutionTarget = defaultFallbackExecutionTarget as Awaited<
    ReturnType<typeof resolveExecutionTarget>
  >;
  let supportingDefinitions: Array<
    Awaited<ReturnType<typeof getAgentDefinitionBySlug>>
  > = [];

  type TurnSetupResult = {
    primaryDefinition: Awaited<ReturnType<typeof getAgentDefinitionBySlug>>;
    primaryPrompt: Awaited<ReturnType<typeof getActiveSystemPrompt>> | null;
    orchestrationPlan: Awaited<ReturnType<typeof planConversationTurn>>;
    primaryExecutionTarget: Awaited<ReturnType<typeof resolveExecutionTarget>>;
    supportingDefinitions: Array<
      Awaited<ReturnType<typeof getAgentDefinitionBySlug>>
    >;
  };

  try {
    ({
      primaryDefinition,
      primaryPrompt,
      orchestrationPlan,
      primaryExecutionTarget,
      supportingDefinitions,
    } = await withTimeout(
      (async (): Promise<TurnSetupResult> => {
        const loadedPrimaryDefinition = await getAgentDefinitionBySlug(
          params.agentId
        );
        const loadedPrimaryPrompt = loadedPrimaryDefinition
          ? await getActiveSystemPrompt(loadedPrimaryDefinition.id)
          : null;
        const loadedOrchestrationPlan = await planConversationTurn({
          userId: params.userId,
          conversationId: params.conversationId,
          primaryAgentSlug: params.agentId,
          supportingAgentSlugs: consultationPlan.consultedAgentSlugs,
          latestUserMessage: params.userMessage,
        });
        const loadedPrimaryExecutionTarget = await resolveExecutionTarget({
          providerId:
            loadedOrchestrationPlan.primaryContext.resolvedAgentProfile
              .providerId ?? null,
          modelId:
            loadedOrchestrationPlan.primaryContext.resolvedAgentProfile.modelId ??
            null,
        });
        const loadedSupportingDefinitions = await Promise.all(
          consultationPlan.consultedAgentSlugs.map(slug =>
            getAgentDefinitionBySlug(slug)
          )
        );

        return {
          primaryDefinition: loadedPrimaryDefinition,
          primaryPrompt: loadedPrimaryPrompt,
          orchestrationPlan: loadedOrchestrationPlan,
          primaryExecutionTarget: loadedPrimaryExecutionTarget,
          supportingDefinitions: loadedSupportingDefinitions,
        };
      })(),
      {
        label: "Conversation turn setup",
        timeoutMs: TURN_SETUP_TIMEOUT_MS,
      }
    ));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Conversation turn setup timed out.";
    logServerError("chat.turn-setup-timeout.fallback", error, {
      conversationId: params.conversationId,
      agentId: params.agentId,
    });
    return buildLimitedTurnReply({
      note:
        "Aura took too long to prepare the full context for this turn, so it returned a faster fallback instead of hanging.",
      executionNotes: [message],
      consultationMode: "none",
      consultationReason: message,
    });
  }

  await emitStage("context");

  const primaryContext = orchestrationPlan.primaryContext;
  const accessibleFiles = primaryContext.accessibleFiles;
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

  const contextSummary = buildContextSummary({
    recentMessages: primaryContext.recentMessages,
    accessibleFiles,
    conversationSummary: primaryContext.conversationSummary,
    customContext: primaryContext.resolvedAgentProfile.customContext,
    trainingNotes: primaryContext.resolvedAgentProfile.trainingNotes,
    allowVaultContext: primaryContext.resolvedAgentProfile.allowVaultContext,
  });
  const missingContext = collectMissingContext({
    recentMessages: primaryContext.recentMessages,
    accessibleFiles,
    conversationSummary: primaryContext.conversationSummary,
    customContext: primaryContext.resolvedAgentProfile.customContext,
    trainingNotes: primaryContext.resolvedAgentProfile.trainingNotes,
    allowVaultContext: primaryContext.resolvedAgentProfile.allowVaultContext,
  });

  const sections = [
    `Primary agent: ${primaryDefinition?.name ?? params.agentId}.`,
    supportingNames.length > 0
      ? `Supporting agents consulted: ${supportingNames.join(", ")}.`
      : "No supporting agents were consulted in this turn.",
    `Conversation mode: ${orchestrationPlan.orchestrationMode}.`,
    `User request: ${params.userMessage}`,
    primaryContext.conversationSummary
      ? `Conversation summary: ${primaryContext.conversationSummary}`
      : "Conversation summary: none.",
    `Accessible vault context: ${accessibleSummary}`,
    primaryContext.resolvedAgentProfile.customContext
      ? `User-specific agent context: ${primaryContext.resolvedAgentProfile.customContext}`
      : "User-specific agent context: none configured yet.",
    primaryContext.resolvedAgentProfile.trainingNotes
      ? `Training notes: ${primaryContext.resolvedAgentProfile.trainingNotes}`
      : "Training notes: none configured yet.",
    `Context summary: ${contextSummary}.`,
    missingContext.length > 0
      ? `Missing context: ${missingContext.join(" | ")}`
      : "Missing context: none identified.",
    consultationPlan.rationale
      ? `Consultation rationale: ${consultationPlan.rationale}`
      : "Consultation rationale: none.",
    supportingNames.length > 0
      ? "Specialist consultation is active for this turn. If a model call fails, this preview becomes the fallback instead of breaking the chat."
      : "The primary agent answers directly on the fast path. If the model call fails, this preview becomes the fallback instead of breaking the chat.",
  ];

  const previewContent = sections.join("\n\n");
  const gateway = new ModelGatewayService();
  const supportingRuns = await Promise.all(
    orchestrationPlan.supportingContexts.map(async ({ agentSlug, context }) => {
      await emitStage(`consult-${agentSlug}`);
      const definition =
        supportingDefinitions.find(agent => agent?.slug === agentSlug) ?? null;
      const prompt = definition
        ? await getActiveSystemPrompt(definition.id)
        : null;
      const executionTarget = await resolveExecutionTarget({
        providerId: context.resolvedAgentProfile.providerId ?? null,
        modelId: context.resolvedAgentProfile.modelId ?? null,
      });
      const supportingMessages = [
        {
          role: "user" as const,
          content: formatPromptContext({
            userMessage: params.userMessage,
            conversationSummary: context.conversationSummary,
            recentMessages: context.recentMessages,
            accessibleFiles: context.accessibleFiles,
            customContext: context.resolvedAgentProfile.customContext,
            trainingNotes: context.resolvedAgentProfile.trainingNotes,
            allowVaultContext: context.resolvedAgentProfile.allowVaultContext,
            consultationRationale: consultationPlan.rationale,
            taskInstruction:
              "Return a short specialist consultation for the primary assistant. Focus on the highest-signal domain insight and mention uncertainty instead of inventing facts.",
          }),
        },
      ];

      const supportingSystemPrompt = buildSupportingSystemPrompt({
        agentSlug,
        agentName: definition?.name ?? agentSlug,
        basePrompt:
          prompt?.templateText ??
          `You are ${definition?.name ?? agentSlug}. Provide concise specialist support to the primary agent.`,
        responseStyle: context.resolvedAgentProfile.responseStyle,
      });

      try {
        const generation = await withAbortableTimeout(
          signal =>
            gateway.generateText({
              providerSlug: executionTarget.providerSlug,
              modelName: executionTarget.modelName,
              systemPrompt: supportingSystemPrompt,
              messages: supportingMessages,
              signal,
            }),
          {
            label: `${definition?.name ?? agentSlug} consultation`,
            timeoutMs: SUPPORTING_AGENT_TIMEOUT_MS,
          }
        );

        return {
          agentSlug,
          agentDefinitionId: definition?.id ?? null,
          agentName: definition?.name ?? agentSlug,
          requestedProviderSlug: executionTarget.requestedProviderSlug,
          requestedModelName: executionTarget.requestedModelName,
          executionNotes: executionTarget.executionNotes,
          systemPrompt: supportingSystemPrompt,
          inputMessages: supportingMessages,
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
          requestedProviderSlug: executionTarget.requestedProviderSlug,
          requestedModelName: executionTarget.requestedModelName,
          executionNotes: executionTarget.executionNotes,
          systemPrompt: supportingSystemPrompt,
          inputMessages: supportingMessages,
          content: `Supporting consultation planned for ${definition?.name ?? agentSlug}, but the model call failed and the run fell back to preview mode.`,
          status: "failed" as const,
          providerSlug: executionTarget.providerSlug,
          modelName: "fallback-preview",
          inputTokens: undefined,
          outputTokens: undefined,
          errorMessage:
            error instanceof Error ? error.message : "Supporting model call failed.",
        };
      }
    })
  );

  const modelMessages = [
    {
      role: "user" as const,
      content: formatPromptContext({
        userMessage: params.userMessage,
        conversationSummary: primaryContext.conversationSummary,
        recentMessages: primaryContext.recentMessages,
        accessibleFiles,
        customContext: primaryContext.resolvedAgentProfile.customContext,
        trainingNotes: primaryContext.resolvedAgentProfile.trainingNotes,
        allowVaultContext: primaryContext.resolvedAgentProfile.allowVaultContext,
        consultationRationale: consultationPlan.rationale,
        supportingNotes: supportingRuns.map(run => ({
          agentName: run.agentName,
          content: run.content,
          status: run.status,
        })),
        taskInstruction:
          "Produce a helpful user-facing answer that stays grounded in the supplied context. Be explicit about what is known, what is inferred, and what is still missing.",
      }),
    },
  ];
  const primarySystemPrompt = buildPrimarySystemPrompt({
    agentSlug: params.agentId,
    agentName: primaryDefinition?.name ?? params.agentId,
    basePrompt:
      primaryPrompt?.templateText ??
      `You are ${primaryDefinition?.name ?? params.agentId}. Answer helpfully and clearly.`,
    responseStyle: primaryContext.resolvedAgentProfile.responseStyle,
    canConsultSpecialists: consultationPlan.consultedAgentSlugs.length > 0,
  });

  try {
    await emitStage("draft");

    logServerDebug("chat.primary-generation.start", {
      conversationId: params.conversationId,
      agentId: params.agentId,
      providerSlug: primaryExecutionTarget.providerSlug,
      modelName: primaryExecutionTarget.modelName,
      streamedToClient: Boolean(params.streamPrimary),
    });

    const generation = await withAbortableTimeout(
      signal =>
        generatePrimaryReply({
          gateway,
          providerSlug: primaryExecutionTarget.providerSlug,
          modelName: primaryExecutionTarget.modelName,
          systemPrompt: primarySystemPrompt,
          messages: modelMessages,
          signal,
          streamPrimary: params.streamPrimary,
          onTextDelta: params.onTextDelta,
        }),
      {
        label: "Primary response generation",
        timeoutMs: PRIMARY_AGENT_TIMEOUT_MS,
      }
    );

    if (!params.streamPrimary) {
      for (const chunk of splitMessageForReveal(generation.text)) {
        await params.onTextDelta?.(chunk);
      }
    }

    logServerDebug("chat.primary-generation.completed", {
      conversationId: params.conversationId,
      agentId: params.agentId,
      providerSlug: generation.providerSlug,
      modelName: generation.modelName,
      outputTokens: generation.outputTokens,
    });

    return {
      content: generation.text,
      relatedVaultFiles: accessibleFiles.map(file => file.filename),
      orchestrationMode: orchestrationPlan.orchestrationMode,
      consultedAgentSlugs: consultationPlan.consultedAgentSlugs,
      supportingAgentNames: supportingNames,
      consultationMode: consultationPlan.mode,
      consultationReason: consultationPlan.rationale,
      contextSummary,
      missingContext,
      executionNotes: primaryExecutionTarget.executionNotes,
      supportingRuns,
      operationalFailureReason: null,
      note:
        accessibleFiles.length === 0 &&
        primaryContext.resolvedAgentProfile.allowVaultContext
          ? "Podes subir estudios o notas al vault para personalizar mejor la respuesta."
          : null,
      primaryRun: {
        providerSlug: generation.providerSlug,
        modelName: generation.modelName,
        requestedProviderSlug: primaryExecutionTarget.requestedProviderSlug,
        requestedModelName: primaryExecutionTarget.requestedModelName,
        executionNotes: primaryExecutionTarget.executionNotes,
        systemPrompt: primarySystemPrompt,
        inputMessages: modelMessages,
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

    const operationalFailureReason = extractOperationalFailureReason(error);

    const gracefulFallback = buildContextAwareFallbackReply({
      userMessage: params.userMessage,
      agentName: primaryDefinition?.name ?? params.agentId,
      allowedCategories:
        orchestrationPlan.primaryContext.resolvedAgentProfile.allowedVaultCategories,
      accessibleFileCount: accessibleFiles.length,
    });

    if (params.streamPrimary) {
      for (const chunk of splitMessageForReveal(gracefulFallback.content)) {
        await params.onTextDelta?.(chunk);
      }
    }

    return {
      content: gracefulFallback.content,
      relatedVaultFiles: accessibleFiles.map(file => file.filename),
      orchestrationMode: orchestrationPlan.orchestrationMode,
      consultedAgentSlugs: consultationPlan.consultedAgentSlugs,
      supportingAgentNames: supportingNames,
      consultationMode: consultationPlan.mode,
      consultationReason: consultationPlan.rationale,
      contextSummary,
      missingContext,
      executionNotes: operationalFailureReason
        ? [...primaryExecutionTarget.executionNotes, operationalFailureReason]
        : primaryExecutionTarget.executionNotes,
      supportingRuns,
      operationalFailureReason,
      note: buildOperationalFallbackNote({
        operationalFailureReason,
        fallbackReplyNote: gracefulFallback.note,
      }),
      primaryRun: {
        providerSlug: primaryExecutionTarget.providerSlug,
        modelName: "fallback-preview",
        requestedProviderSlug: primaryExecutionTarget.requestedProviderSlug,
        requestedModelName: primaryExecutionTarget.requestedModelName,
        executionNotes: primaryExecutionTarget.executionNotes,
        systemPrompt: primarySystemPrompt,
        inputMessages: modelMessages,
        inputTokens: undefined,
        outputTokens: undefined,
        errorMessage: operationalFailureReason ?? previewContent,
        usedFallback: true,
      },
      responseMode: "limited" as const,
    };
  }
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

export async function sendChatMessage(params: {
  input: ChatSendMessageInput;
  userId: number;
  streamPrimary?: boolean;
  onStage?: (stage: ChatTurnStage) => void | Promise<void>;
  onTextDelta?: (delta: string) => void | Promise<void>;
}) {
  const db = getDb();
  const conversation = await requireConversationOwner(
    params.input.conversationId,
    params.userId
  );

  const participants = await syncConversationParticipants({
    conversationId: params.input.conversationId,
    primaryAgentSlug: params.input.agentId,
    supportingAgentSlugs: params.input.calledAgentIds,
  });

  const userMetadata = {
    calledAgents:
      params.input.calledAgentIds.length > 0
        ? params.input.calledAgentIds
        : undefined,
  };
  const assistantReply = await buildAssistantReply({
    userMessage: params.input.content,
    agentId: params.input.agentId,
    availableSupportingAgentIds: params.input.calledAgentIds,
    userId: params.userId,
    conversationId: params.input.conversationId,
    streamPrimary: params.streamPrimary,
    onStage: params.onStage,
    onTextDelta: params.onTextDelta,
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
  const assistantMetadata = {
    calledAgents:
      assistantReply.consultedAgentSlugs.length > 0
        ? assistantReply.consultedAgentSlugs
        : undefined,
    relatedVaultFiles: assistantReply.relatedVaultFiles,
    orchestrationMode: assistantReply.orchestrationMode,
    note:
      assistantReply.note ??
      (assistantReply.responseMode === "limited"
        ? `${assistantReply.primaryRun.providerSlug} no respondio correctamente y esta respuesta salio en modo fallback.`
        : `${assistantReply.primaryRun.providerSlug} respondio en vivo.`),
    responseMode: assistantReply.responseMode,
    consultedAgentNames:
      assistantReply.supportingAgentNames.length > 0
        ? assistantReply.supportingAgentNames
        : undefined,
    consultationMode: assistantReply.consultationMode,
    consultationReason: assistantReply.consultationReason ?? undefined,
    contextSummary: assistantReply.contextSummary,
    missingContext:
      assistantReply.missingContext.length > 0
        ? assistantReply.missingContext
        : undefined,
    executionNotes:
      assistantReply.executionNotes.length > 0
        ? assistantReply.executionNotes
        : undefined,
    providerSlug: assistantReply.primaryRun.providerSlug,
    modelName: assistantReply.primaryRun.modelName,
    requestedProviderSlug:
      assistantReply.primaryRun.requestedProviderSlug ?? undefined,
    requestedModelName:
      assistantReply.primaryRun.requestedModelName ?? undefined,
    inputTokens: assistantReply.primaryRun.inputTokens,
    outputTokens: assistantReply.primaryRun.outputTokens,
  };
  let assistantMessageRecord:
    | {
        id: number;
        createdAt: Date;
      }
    | undefined;

  await db.transaction(async tx => {
    const insertedUserMessage = await tx
      .insert(messages)
      .values({
        conversationId: params.input.conversationId,
        role: "user",
        kind: "user",
        content: params.input.content,
        agentId: params.input.agentId,
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
        conversationId: params.input.conversationId,
        role: "assistant",
        kind: "assistant",
        content: assistantReply.content,
        agentId: params.input.agentId,
        metadata: JSON.stringify(assistantMetadata),
      })
      .returning({ id: messages.id, createdAt: messages.createdAt });

    assistantMessageRecord = insertedAssistantMessage[0];
    const assistantMessageId = assistantMessageRecord?.id;
    if (assistantMessageId == null) {
      throw new Error("Failed to create the assistant message record.");
    }

    const primaryRun = await tx
      .insert(agentRuns)
      .values({
        conversationId: params.input.conversationId,
        messageId: assistantMessageId,
        agentDefinitionId: participants.primary.id,
        runType: "primary_reply",
        providerId: primaryModelReference.providerId,
        modelEndpointId: primaryModelReference.modelEndpointId,
        status: assistantReply.primaryRun.usedFallback ? "failed" : "completed",
        inputMessagesJson: assistantReply.primaryRun.inputMessages,
        resolvedSystemPrompt: assistantReply.primaryRun.systemPrompt,
        resolvedUserContext: params.input.content,
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
        conversationId: params.input.conversationId,
        messageId: userMessageId,
        agentDefinitionId: supportingRun.agentDefinitionId,
        runType: "supporting_consult",
        providerId: supportingModelReferences[index]?.providerId ?? null,
        modelEndpointId:
          supportingModelReferences[index]?.modelEndpointId ?? null,
        status: supportingRun?.status ?? "failed",
        inputMessagesJson: supportingRun?.inputMessages ?? [],
        resolvedSystemPrompt: supportingRun?.systemPrompt ?? null,
        resolvedUserContext: params.input.content,
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
        conversationId: params.input.conversationId,
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
        agentId: params.input.agentId,
        title:
          conversation.title === "New conversation" || !conversation.title
            ? buildConversationTitle(params.input.content)
            : conversation.title,
        orchestrationMode: assistantReply.orchestrationMode as
          | "single_agent"
          | "primary_plus_supporting"
          | "review_loop",
        lastAgentRunAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, params.input.conversationId));
  });

  logServerDebug("chat.sendMessage", {
    userId: params.userId,
    conversationId: params.input.conversationId,
    agentId: params.input.agentId,
    supportingAgentCount: params.input.calledAgentIds.length,
    streamed: Boolean(params.streamPrimary),
  });

  return {
    success: true,
    assistantMessage: assistantMessageRecord
      ? {
          id: assistantMessageRecord.id,
          role: "assistant" as const,
          content: assistantReply.content,
          agentId: params.input.agentId,
          createdAt: assistantMessageRecord.createdAt,
          metadata: assistantMetadata,
        }
      : null,
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

import { logServerDebug, logServerError } from "../lib/debug.js";
import {
  getActiveSystemPrompt,
  getAgentDefinitionBySlug,
} from "../queries/agents.js";
import { resolveConsultationPlan } from "./consultation-policy.js";
import { resolveExecutionTarget } from "./execution-target.js";
import { ModelGatewayService } from "./model-gateway.js";
import { planConversationTurn } from "./conversation-orchestrator.js";
import { buildContextAwareFallbackReply } from "./fallback-reply.js";
import {
  buildOperationalFallbackNote,
  extractOperationalFailureReason,
} from "./chat-fallback.js";
import {
  buildPrimarySystemPrompt,
  buildSupportingSystemPrompt,
} from "./prompt-composer.js";
import {
  buildContextSummary,
  collectMissingContext,
  formatPromptContext,
} from "./context-prompt.js";
import { withAbortableTimeout, withTimeout } from "./async-guard.js";
import {
  buildPendingTurnStages,
  splitMessageForReveal,
} from "../../src/lib/chat-experience.js";

const SUPPORTING_AGENT_TIMEOUT_MS = 15_000;
const PRIMARY_AGENT_TIMEOUT_MS = 25_000;
const TURN_SETUP_TIMEOUT_MS = 10_000;

export type ChatTurnStage = {
  id: string;
  label: string;
};

export type ChatTurnStreamHandlers = {
  onStage?: (stage: ChatTurnStage) => void | Promise<void>;
  onTextDelta?: (delta: string) => void | Promise<void>;
  streamPrimary?: boolean;
};

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type SupportingRunReply = {
  agentSlug: string;
  agentDefinitionId: number | null;
  agentName: string;
  requestedProviderSlug: string | null;
  requestedModelName: string | null;
  executionNotes: string[];
  systemPrompt: string;
  inputMessages: ModelMessage[];
  content: string;
  status: "completed" | "failed";
  providerSlug: string;
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage: string | null;
};

export type AssistantReply = {
  content: string;
  relatedVaultFiles: string[];
  orchestrationMode: "single_agent" | "primary_plus_supporting" | "review_loop";
  consultedAgentSlugs: string[];
  supportingAgentNames: string[];
  consultationMode: "none" | "explicit" | "auto";
  consultationReason: string | null;
  contextSummary: string;
  missingContext: string[];
  executionNotes: string[];
  supportingRuns: SupportingRunReply[];
  operationalFailureReason: string | null;
  note: string | null;
  primaryRun: {
    providerSlug: string;
    modelName: string;
    requestedProviderSlug: string | null;
    requestedModelName: string | null;
    executionNotes: string[];
    systemPrompt: string;
    inputMessages: ModelMessage[];
    inputTokens?: number;
    outputTokens?: number;
    errorMessage?: string | null;
    usedFallback: boolean;
  };
  responseMode: "model" | "limited";
};

function normalizeOrchestrationMode(
  value: string
): AssistantReply["orchestrationMode"] {
  if (
    value === "single_agent" ||
    value === "primary_plus_supporting" ||
    value === "review_loop"
  ) {
    return value;
  }

  return "single_agent";
}

export async function generatePrimaryReply(params: {
  gateway: Pick<ModelGatewayService, "generateText" | "streamText">;
  providerSlug: string;
  modelName: string | null;
  systemPrompt: string;
  messages: ModelMessage[];
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

export async function buildAssistantReply(
  params: {
    userMessage: string;
    agentId: string;
    availableSupportingAgentIds: string[];
    userId: number;
    conversationId: number;
  } & ChatTurnStreamHandlers
): Promise<AssistantReply> {
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
  }): Promise<AssistantReply> => {
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
      orchestrationMode: "single_agent",
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
            role: "user",
            content: params.userMessage,
          },
        ],
        inputTokens: undefined,
        outputTokens: undefined,
        errorMessage: input.operationalFailureReason ?? input.note,
        usedFallback: true,
      },
      responseMode: "limited",
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
      const supportingMessages: ModelMessage[] = [
        {
          role: "user",
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

  const modelMessages: ModelMessage[] = [
    {
      role: "user",
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
      orchestrationMode: normalizeOrchestrationMode(
        orchestrationPlan.orchestrationMode
      ),
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
      responseMode: "model",
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
      orchestrationMode: normalizeOrchestrationMode(
        orchestrationPlan.orchestrationMode
      ),
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
      responseMode: "limited",
    };
  }
}

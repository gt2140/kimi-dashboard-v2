import { and, desc, eq } from "drizzle-orm";
import { messages, promptTemplates } from "../../db/schema.js";
import { logServerDebug } from "../lib/debug.js";
import {
  AgentRunRepository,
  resolveModelReference,
} from "../repositories/agent-run-repository.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { getDb } from "../queries/connection.js";
import { syncConversationParticipants } from "./conversation-participants.js";
import {
  type ConversationTurnRuntime,
  type ConversationTurnRuntimeInput,
} from "./conversation-turn-runtime.js";
import { ModelGatewayService } from "./model-gateway.js";

type RuntimeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ConversationRepositoryLike = Pick<
  ConversationRepository,
  | "requireConversationOwner"
  | "createUserMessage"
  | "createAssistantMessage"
  | "updateConversationAfterTurn"
>;

type AgentRunRepositoryLike = Pick<
  AgentRunRepository,
  | "createPrimaryRun"
  | "markPrimaryRunRunning"
  | "finalizePrimaryRun"
  | "finalizePrimaryRunFailure"
>;

type ModelGatewayLike = Pick<
  ModelGatewayService,
  "generateText" | "streamText" | "getDefaultModel"
>;
type ParticipantSync = typeof syncConversationParticipants;
type ModelReferenceResolver = typeof resolveModelReference;

type LightweightContext = {
  agentDefinitionId: number;
  systemPrompt: string;
  messages: RuntimeMessage[];
  conversationSummary: string | null;
};

type LightweightContextLoader = (params: {
  conversationId: number;
  agentDefinitionId: number;
  conversationSummary: string | null;
}) => Promise<LightweightContext>;

async function loadLightweightConversationContext(params: {
  conversationId: number;
  agentDefinitionId: number;
  conversationSummary: string | null;
}): Promise<LightweightContext> {
  const db = getDb();
  const [promptRow] = await db
    .select({ templateText: promptTemplates.templateText })
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.agentDefinitionId, params.agentDefinitionId),
        eq(promptTemplates.kind, "system"),
        eq(promptTemplates.isActive, true)
      )
    )
    .orderBy(desc(promptTemplates.version))
    .limit(1);

  const recentRows = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, params.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(6);

  const messagesForModel = recentRows.reverse().map(message => ({
    role: message.role,
    content: message.content,
  }));

  const systemPrompt = [
    promptRow?.templateText?.trim() ||
      "You are Aura, a calm and practical generalist assistant.",
    params.conversationSummary?.trim()
      ? `Existing conversation summary:\n${params.conversationSummary.trim()}`
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

  return {
    agentDefinitionId: params.agentDefinitionId,
    systemPrompt,
    messages: messagesForModel,
    conversationSummary: params.conversationSummary,
  };
}

export class VeniceFirstConversationTurnRuntime implements ConversationTurnRuntime {
  private readonly conversationRepository: ConversationRepositoryLike;
  private readonly agentRunRepository: AgentRunRepositoryLike;
  private readonly modelGateway: ModelGatewayLike;
  private readonly contextLoader: LightweightContextLoader;
  private readonly syncParticipants: ParticipantSync;
  private readonly resolveModelReference: ModelReferenceResolver;

  constructor(
    dependencies: {
      conversationRepository?: ConversationRepositoryLike;
      agentRunRepository?: AgentRunRepositoryLike;
      modelGateway?: ModelGatewayLike;
      contextLoader?: LightweightContextLoader;
      syncParticipants?: ParticipantSync;
      resolveModelReference?: ModelReferenceResolver;
    } = {}
  ) {
    this.conversationRepository =
      dependencies.conversationRepository ?? new ConversationRepository();
    this.agentRunRepository =
      dependencies.agentRunRepository ?? new AgentRunRepository();
    this.modelGateway = dependencies.modelGateway ?? new ModelGatewayService();
    this.contextLoader =
      dependencies.contextLoader ?? loadLightweightConversationContext;
    this.syncParticipants =
      dependencies.syncParticipants ?? syncConversationParticipants;
    this.resolveModelReference =
      dependencies.resolveModelReference ?? resolveModelReference;
  }

  async executeTurn(input: ConversationTurnRuntimeInput) {
    logServerDebug("chat.turn.venice.start", {
      conversationId: input.conversationId,
      userId: input.userId,
      agentId: input.agentId,
      requestedModelName: input.requestedModelName ?? null,
      streamed: input.stream,
    });

    const conversation =
      await this.conversationRepository.requireConversationOwner(
        input.conversationId,
        input.userId
      );

    await input.onStage?.({
      id: "memory",
      label: "Loading recent chat context",
    });

    const userMessage = await this.conversationRepository.createUserMessage({
      conversationId: input.conversationId,
      content: input.content,
      agentId: input.agentId,
      metadata: {},
    });

    const participants = await this.syncParticipants({
      conversationId: input.conversationId,
      primaryAgentSlug: input.agentId || "generalist",
      supportingAgentSlugs: [],
    });

    const primaryRun = await this.agentRunRepository.createPrimaryRun({
      conversationId: input.conversationId,
      agentDefinitionId: participants.primary.id,
      resolvedUserContext: input.content,
    });
    await this.agentRunRepository.markPrimaryRunRunning(primaryRun.id);

    try {
      const context = await this.contextLoader({
        conversationId: input.conversationId,
        agentDefinitionId: participants.primary.id,
        conversationSummary: conversation.summary ?? null,
      });

      await input.onStage?.({
        id: "draft",
        label: input.stream
          ? "Streaming Venice response"
          : "Writing Venice response",
      });

      const requestedModelName = input.requestedModelName?.trim() || null;
      const modelResult = input.stream
        ? await this.modelGateway.streamText({
            providerSlug: "venice",
            modelName: requestedModelName,
            systemPrompt: context.systemPrompt,
            messages: context.messages,
            signal: input.signal,
            onTextDelta: input.onTextDelta,
          })
        : await this.modelGateway.generateText({
            providerSlug: "venice",
            modelName: requestedModelName,
            systemPrompt: context.systemPrompt,
            messages: context.messages,
            signal: input.signal,
          });

      const assistantMetadata = {
        engine: "aura-chat-v1" as const,
        providerSlug: "venice" as const,
        modelName: modelResult.modelName,
        requestedModelName,
        inputTokens: modelResult.inputTokens,
        outputTokens: modelResult.outputTokens,
      };

      const assistantMessage =
        await this.conversationRepository.createAssistantMessage({
          conversationId: input.conversationId,
          content: modelResult.text,
          agentId: input.agentId,
          metadata: assistantMetadata,
        });

      await this.conversationRepository.updateConversationAfterTurn({
        conversation,
        userMessage: input.content,
        agentId: input.agentId,
        orchestrationMode: "single_agent",
      });

      const modelReference = await this.resolveModelReference(
        "venice",
        modelResult.modelName
      );
      await this.agentRunRepository.finalizePrimaryRun(primaryRun.id, {
        messageId: assistantMessage.id,
        providerId: modelReference.providerId,
        modelEndpointId: modelReference.modelEndpointId,
        status: "completed",
        inputMessages: [
          { role: "system", content: context.systemPrompt },
          ...context.messages,
        ],
        systemPrompt: context.systemPrompt,
        outputText: modelResult.text,
        inputTokens: modelResult.inputTokens,
        outputTokens: modelResult.outputTokens,
        usageJson: {
          engine: "aura-chat-v1",
          providerSlug: "venice",
          requestedModelName,
        },
      });

      logServerDebug("chat.turn.venice.completed", {
        conversationId: input.conversationId,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        primaryRunId: primaryRun.id,
        modelName: modelResult.modelName,
      });

      return {
        success: true as const,
        assistantMessage: {
          id: assistantMessage.id,
          role: "assistant" as const,
          content: modelResult.text,
          agentId: input.agentId,
          createdAt: assistantMessage.createdAt,
          metadata: assistantMetadata,
        },
      };
    } catch (error) {
      await this.agentRunRepository.finalizePrimaryRunFailure(primaryRun.id, {
        errorMessage:
          error instanceof Error
            ? error.message
            : "Venice chat turn failed unexpectedly.",
      });
      throw error;
    }
  }
}

export const auraChatConversationTurnRuntime =
  new VeniceFirstConversationTurnRuntime();

export const kimiConversationTurnService = auraChatConversationTurnRuntime;
export const auraMedicalConversationTurnService =
  auraChatConversationTurnRuntime;

export { loadLightweightConversationContext };

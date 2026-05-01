import { logServerDebug } from "../lib/debug.js";
import {
  AgentRunRepository,
  resolveModelReference,
} from "../repositories/agent-run-repository.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import {
  buildAssistantReply,
  type AssistantReply,
  type ChatTurnStage,
} from "./chat-reply-builder.js";
import { syncConversationParticipants } from "./conversation-participants.js";

export type ConversationTurnInput = {
  conversationId: number;
  content: string;
  agentId: string;
  calledAgentIds: string[];
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
  | "createSupportingRuns"
  | "createMessageContextBlocks"
>;

type ConversationParticipantsSync = typeof syncConversationParticipants;
type ModelReferenceResolver = typeof resolveModelReference;
type ReplyBuilder = {
  buildReply: typeof buildAssistantReply;
};

function buildUserMetadata(input: ConversationTurnInput) {
  return {
    calledAgents: input.calledAgentIds.length > 0 ? input.calledAgentIds : undefined,
  };
}

function buildAssistantMetadata(reply: AssistantReply) {
  return {
    calledAgents:
      reply.consultedAgentSlugs.length > 0
        ? reply.consultedAgentSlugs
        : undefined,
    relatedVaultFiles: reply.relatedVaultFiles,
    orchestrationMode: reply.orchestrationMode,
    note:
      reply.note ??
      (reply.responseMode === "limited"
        ? `${reply.primaryRun.providerSlug} no respondio correctamente y esta respuesta salio en modo fallback.`
        : `${reply.primaryRun.providerSlug} respondio en vivo.`),
    responseMode: reply.responseMode,
    consultedAgentNames:
      reply.supportingAgentNames.length > 0
        ? reply.supportingAgentNames
        : undefined,
    consultationMode: reply.consultationMode,
    consultationReason: reply.consultationReason ?? undefined,
    contextSummary: reply.contextSummary,
    missingContext:
      reply.missingContext.length > 0 ? reply.missingContext : undefined,
    executionNotes:
      reply.executionNotes.length > 0 ? reply.executionNotes : undefined,
    providerSlug: reply.primaryRun.providerSlug,
    modelName: reply.primaryRun.modelName,
    requestedProviderSlug: reply.primaryRun.requestedProviderSlug ?? undefined,
    requestedModelName: reply.primaryRun.requestedModelName ?? undefined,
    inputTokens: reply.primaryRun.inputTokens,
    outputTokens: reply.primaryRun.outputTokens,
  };
}

export class ConversationTurnService {
  private readonly conversationRepository: ConversationRepositoryLike;
  private readonly agentRunRepository: AgentRunRepositoryLike;
  private readonly syncParticipants: ConversationParticipantsSync;
  private readonly resolveModelReference: ModelReferenceResolver;
  private readonly replyBuilder: ReplyBuilder;

  constructor(dependencies: {
    conversationRepository?: ConversationRepositoryLike;
    agentRunRepository?: AgentRunRepositoryLike;
    syncParticipants?: ConversationParticipantsSync;
    resolveModelReference?: ModelReferenceResolver;
    replyBuilder?: ReplyBuilder;
  } = {}) {
    this.conversationRepository =
      dependencies.conversationRepository ?? new ConversationRepository();
    this.agentRunRepository =
      dependencies.agentRunRepository ?? new AgentRunRepository();
    this.syncParticipants =
      dependencies.syncParticipants ?? syncConversationParticipants;
    this.resolveModelReference =
      dependencies.resolveModelReference ?? resolveModelReference;
    this.replyBuilder = dependencies.replyBuilder ?? {
      buildReply: buildAssistantReply,
    };
  }

  async executeTurn(params: {
    input: ConversationTurnInput;
    userId: number;
    streamPrimary?: boolean;
    onStage?: (stage: ChatTurnStage) => void | Promise<void>;
    onTextDelta?: (delta: string) => void | Promise<void>;
  }) {
    const conversation = await this.conversationRepository.requireConversationOwner(
      params.input.conversationId,
      params.userId
    );

    const participants = await this.syncParticipants({
      conversationId: params.input.conversationId,
      primaryAgentSlug: params.input.agentId,
      supportingAgentSlugs: params.input.calledAgentIds,
    });

    const userMessage = await this.conversationRepository.createUserMessage({
      conversationId: params.input.conversationId,
      content: params.input.content,
      agentId: params.input.agentId,
      metadata: buildUserMetadata(params.input),
    });

    const primaryRun = await this.agentRunRepository.createPrimaryRun({
      conversationId: params.input.conversationId,
      agentDefinitionId: participants.primary.id,
      resolvedUserContext: params.input.content,
    });

    await this.agentRunRepository.markPrimaryRunRunning(primaryRun.id);

    let primaryRunFinalized = false;

    try {
      const assistantReply = await this.replyBuilder.buildReply({
        userMessage: params.input.content,
        agentId: params.input.agentId,
        availableSupportingAgentIds: params.input.calledAgentIds,
        userId: params.userId,
        conversationId: params.input.conversationId,
        streamPrimary: params.streamPrimary,
        onStage: params.onStage,
        onTextDelta: params.onTextDelta,
      });

      const assistantMetadata = buildAssistantMetadata(assistantReply);
      const assistantMessage =
        await this.conversationRepository.createAssistantMessage({
          conversationId: params.input.conversationId,
          content: assistantReply.content,
          agentId: params.input.agentId,
          metadata: assistantMetadata,
        });

      const primaryModelReference = await this.resolveModelReference(
        assistantReply.primaryRun.providerSlug,
        assistantReply.primaryRun.modelName
      );
      const supportingModelReferences = await Promise.all(
        assistantReply.supportingRuns.map(run =>
          this.resolveModelReference(run.providerSlug, run.modelName)
        )
      );

      await this.agentRunRepository.createSupportingRuns({
        conversationId: params.input.conversationId,
        messageId: userMessage.id,
        resolvedUserContext: params.input.content,
        runs: assistantReply.supportingRuns,
        modelReferences: supportingModelReferences,
      });

      await this.agentRunRepository.createMessageContextBlocks({
        conversationId: params.input.conversationId,
        messageId: assistantMessage.id,
        agentRunId: primaryRun.id,
        relatedVaultFiles: assistantReply.relatedVaultFiles,
      });

      await this.conversationRepository.updateConversationAfterTurn({
        conversation,
        userMessage: params.input.content,
        agentId: params.input.agentId,
        orchestrationMode: assistantReply.orchestrationMode,
      });

      await this.agentRunRepository.finalizePrimaryRun(primaryRun.id, {
        messageId: assistantMessage.id,
        providerId: primaryModelReference.providerId,
        modelEndpointId: primaryModelReference.modelEndpointId,
        status: assistantReply.primaryRun.usedFallback ? "failed" : "completed",
        inputMessages: assistantReply.primaryRun.inputMessages,
        systemPrompt: assistantReply.primaryRun.systemPrompt,
        outputText: assistantReply.content,
        inputTokens: assistantReply.primaryRun.inputTokens,
        outputTokens: assistantReply.primaryRun.outputTokens,
        errorMessage: assistantReply.primaryRun.errorMessage,
      });
      primaryRunFinalized = true;

      logServerDebug("chat.sendMessage", {
        userId: params.userId,
        conversationId: params.input.conversationId,
        agentId: params.input.agentId,
        supportingAgentCount: params.input.calledAgentIds.length,
        streamed: Boolean(params.streamPrimary),
      });

      return {
        success: true,
        assistantMessage: {
          id: assistantMessage.id,
          role: "assistant" as const,
          content: assistantReply.content,
          agentId: params.input.agentId,
          createdAt: assistantMessage.createdAt,
          metadata: assistantMetadata,
        },
      };
    } catch (error) {
      if (!primaryRunFinalized) {
        await this.agentRunRepository.finalizePrimaryRunFailure(primaryRun.id, {
          errorMessage:
            error instanceof Error
              ? error.message
              : "Conversation turn failed unexpectedly.",
        });
      }

      throw error;
    }
  }
}

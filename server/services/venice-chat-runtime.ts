import { desc, eq } from "drizzle-orm";
import { messages } from "../../db/schema.js";
import { logServerDebug } from "../lib/debug.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { getDb } from "../queries/connection.js";
import { assembleConversationContext } from "./context-assembler.js";
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

type ModelGatewayLike = Pick<
  ModelGatewayService,
  "generateText" | "streamText" | "getDefaultModel"
>;

type RecentMessageLoader = (params: {
  conversationId: number;
  limit: number;
}) => Promise<RuntimeMessage[]>;

type VeniceTurnContext = Awaited<ReturnType<typeof assembleConversationContext>>;

type VeniceContextLoader = typeof assembleConversationContext;

async function loadRecentConversationMessages(params: {
  conversationId: number;
  limit: number;
}): Promise<RuntimeMessage[]> {
  const db = getDb();
  const recentRows = await db
    .select({
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, params.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(params.limit);

  return recentRows.reverse().map(message => ({
    role: message.role,
    content: message.content,
  }));
}

export class VeniceFirstConversationTurnRuntime implements ConversationTurnRuntime {
  private readonly conversationRepository: ConversationRepositoryLike;
  private readonly modelGateway: ModelGatewayLike;
  private readonly loadRecentMessages: RecentMessageLoader;
  private readonly contextLoader: VeniceContextLoader;

  constructor(
    dependencies: {
      conversationRepository?: ConversationRepositoryLike;
      modelGateway?: ModelGatewayLike;
      loadRecentMessages?: RecentMessageLoader;
      contextLoader?: VeniceContextLoader;
    } = {}
  ) {
    this.conversationRepository =
      dependencies.conversationRepository ?? new ConversationRepository();
    this.modelGateway = dependencies.modelGateway ?? new ModelGatewayService();
    this.loadRecentMessages =
      dependencies.loadRecentMessages ?? loadRecentConversationMessages;
    this.contextLoader = dependencies.contextLoader ?? assembleConversationContext;
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

    const turnContext = await this.loadTurnContext(input).catch(error => {
      logServerDebug("chat.turn.venice.context-fallback", {
        conversationId: input.conversationId,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Context loader failed unexpectedly.",
      });
      return null;
    });
    const recentMessages = turnContext
      ? turnContext.recentMessages.map(message => ({
          role: message.role,
          content: message.content,
        }))
      : await this.loadRecentMessages({
        conversationId: input.conversationId,
        limit: 6,
      });
    const systemPrompt = buildVeniceSystemPrompt({
      conversationSummary:
        turnContext?.conversationSummary ?? conversation.summary ?? null,
      context: turnContext,
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
          systemPrompt,
          messages: recentMessages,
          signal: input.signal,
          onTextDelta: input.onTextDelta,
        })
      : await this.modelGateway.generateText({
          providerSlug: "venice",
          modelName: requestedModelName,
          systemPrompt,
          messages: recentMessages,
          signal: input.signal,
        });

    const assistantMetadata = {
      engine: "aura-chat-v1" as const,
      providerSlug: "venice" as const,
      modelName: modelResult.modelName,
      requestedModelName,
      relatedVaultFiles:
        turnContext && turnContext.accessibleFiles.length > 0
          ? turnContext.accessibleFiles.map(file => file.filename)
          : undefined,
      contextSummary: turnContext
        ? buildVeniceContextSummary(turnContext)
        : undefined,
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

    logServerDebug("chat.turn.venice.completed", {
      conversationId: input.conversationId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
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
  }

  private loadTurnContext(input: ConversationTurnRuntimeInput) {
    return this.contextLoader({
      userId: input.userId,
      conversationId: input.conversationId,
      agentSlug: input.agentId,
      latestUserMessage: input.content,
    });
  }
}

export const auraChatConversationTurnRuntime =
  new VeniceFirstConversationTurnRuntime();

export { loadRecentConversationMessages };

function buildVeniceContextSummary(context: VeniceTurnContext) {
  const recentMessageCount = context.recentMessages.length;
  const vaultFileCount = context.accessibleFiles.length;
  const customContextEnabled = Boolean(
    context.resolvedAgentProfile.customContext?.trim(),
  );
  const trainingNotesEnabled = Boolean(
    context.resolvedAgentProfile.trainingNotes?.trim(),
  );

  return [
    `${recentMessageCount} recent message${recentMessageCount === 1 ? "" : "s"}`,
    `${vaultFileCount} vault file${vaultFileCount === 1 ? "" : "s"}`,
    customContextEnabled ? "agent preset enabled" : "no agent preset",
    trainingNotesEnabled ? "training notes enabled" : "no training notes",
  ].join(" | ");
}

function buildVeniceSystemPrompt(input: {
  conversationSummary: string | null;
  context: VeniceTurnContext | null;
}) {
  const context = input.context;
  const vaultFiles = context?.accessibleFiles ?? [];
  const vaultContext = context?.vaultContext;
  const customContext = context?.resolvedAgentProfile.customContext?.trim();
  const trainingNotes = context?.resolvedAgentProfile.trainingNotes?.trim();

  return [
    "You are Aura, a calm and practical generalist assistant.",
    input.conversationSummary?.trim()
      ? `Existing conversation summary:\n${input.conversationSummary.trim()}`
      : null,
    customContext ? `Agent preset context:\n${customContext}` : null,
    trainingNotes ? `Agent training notes:\n${trainingNotes}` : null,
    vaultFiles.length > 0
      ? [
          "Available vault files for this turn:",
          ...vaultFiles
            .slice(0, 8)
            .map(file => `- ${file.filename} (${file.category})`),
          "Do not claim to have read file contents unless the content is explicitly included in the prompt.",
        ].join("\n")
      : context?.resolvedAgentProfile.allowVaultContext
        ? "Vault context is enabled, but no compatible ready files were available for this turn."
        : null,
    vaultContext &&
    (
      vaultContext.clinicalProfileSummary?.trim() ||
      vaultContext.selectedVaultChunks.length > 0
    )
      ? [
          "Vault extracted context for this turn:",
          vaultContext.clinicalProfileSummary?.trim()
            ? `Clinical profile summary:\n${truncatePromptText(vaultContext.clinicalProfileSummary.trim(), 1200)}`
            : null,
          vaultContext.selectedVaultChunks.length > 0
            ? [
                "Relevant vault excerpts:",
                ...vaultContext.selectedVaultChunks
                  .slice(0, 4)
                  .map(
                    chunk =>
                      `- [document ${chunk.documentId}, chunk ${chunk.chunkIndex}] ${truncatePromptText(chunk.content.trim(), 700)}`
                  ),
              ].join("\n")
            : null,
          "Use vault excerpts as user-provided context. If the excerpts are insufficient, say what is missing.",
        ]
          .filter((part): part is string => Boolean(part))
          .join("\n")
      : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

function truncatePromptText(content: string, maxLength: number) {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength - 3)}...`;
}

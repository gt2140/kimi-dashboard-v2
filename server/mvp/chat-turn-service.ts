import { AGENTS } from "../../src/lib/data.js";
import { buildConversationTitle, MvpChatStore } from "./chat-store.js";
import { KimiDirectClient } from "./kimi-direct-client.js";
import { MedicalResearchService } from "../services/medical-research.js";
import { buildMedicalResearchPrompt } from "../services/medical-synthesis.js";

export class MvpChatTurnService {
  constructor(
    private readonly store: MvpChatStore,
    private readonly kimiClient: KimiDirectClient,
    private readonly medicalResearchService = new MedicalResearchService(),
  ) {}

  async execute(params: {
    conversationId?: number;
    content: string;
    agentId: string;
    userId: number;
  }) {
    const conversationId =
      params.conversationId ??
      (
        await this.store.createConversation({
          userId: params.userId,
          agentId: params.agentId,
          title: buildConversationTitle(params.content),
        })
      ).id;

    const conversation = await this.store.requireConversation(
      params.userId,
      conversationId,
    );

    await this.store.createUserMessage({
      conversationId,
      agentId: params.agentId,
      content: params.content,
    });

    const agent =
      AGENTS.find(candidate => candidate.id === params.agentId) ?? AGENTS[0];
    const recentMessages = await this.store.listRecentMessages(
      conversationId,
    );
    const medicalEvidence =
      params.agentId === "research-synthesizer"
        ? await this.medicalResearchService.search(params.content)
        : [];
    const systemPrompt =
      params.agentId === "research-synthesizer"
        ? buildMedicalResearchPrompt({
            userQuestion: params.content,
            evidence: medicalEvidence,
          })
        : agent.systemPrompt;

    const reply = await this.kimiClient.respond({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...recentMessages,
      ],
      userId: params.userId,
    });

    const assistantMessage = await this.store.createAssistantMessage({
      conversationId,
      agentId: params.agentId,
      content: reply.content,
      metadata: {
        engine: "kimi-mvp",
        providerSlug: "kimi",
        modelName: reply.model,
        finishReason: reply.finishReason,
        usage: reply.usage,
        researchEvidence:
          medicalEvidence.length === 0
            ? undefined
            : medicalEvidence.map(item => ({
                source: item.source,
                title: item.title,
                url: item.url,
                citation: item.citation,
              })),
      },
    });

    await this.store.finalizeConversation({
      conversationId,
      currentTitle: conversation.title,
      agentId: params.agentId,
      userMessage: params.content,
    });

    return {
      conversationId,
      id: String(assistantMessage.id),
      role: "assistant" as const,
      content: reply.content,
      agentId: params.agentId,
      createdAt: assistantMessage.createdAt.toISOString(),
      metadata: {
        engine: "kimi-mvp",
        providerSlug: "kimi",
        modelName: reply.model,
        finishReason: reply.finishReason,
        usage: reply.usage,
        researchEvidence:
          medicalEvidence.length === 0
            ? undefined
            : medicalEvidence.map(item => ({
                source: item.source,
                title: item.title,
                url: item.url,
                citation: item.citation,
              })),
      },
    };
  }
}

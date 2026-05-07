import { desc, eq } from "drizzle-orm";
import {
  conversationMemories,
  messages,
  userMemories,
} from "../../db/schema.js";
import { getDb } from "../queries/connection.js";
import {
  getActiveSystemPrompt,
  getAgentDefinitionBySlug,
  getUserAgentSetting,
} from "../queries/agents.js";
import { vaultV2Service } from "./vault-v2-service.js";
import type { VaultDocumentCategory } from "./vault-v2.js";

export async function loadKimiTurnContext(params: {
  userId: number;
  conversationId: number;
  agentSlug: string;
  latestUserMessage: string;
  runtimeVersion?: "classic" | "aura-medical-v1";
  medicalMode?: "personal-health" | "research";
}) {
  const agent = await getAgentDefinitionBySlug(params.agentSlug);
  if (!agent) {
    throw new Error(`Agent ${params.agentSlug} not found.`);
  }

  const [promptTemplate, userSetting, recentMessages, latestSummary, memories] =
    await Promise.all([
      getActiveSystemPrompt(agent.id),
      getUserAgentSetting(params.userId, agent.id),
      getDb()
        .select({
          role: messages.role,
          content: messages.content,
        })
        .from(messages)
        .where(eq(messages.conversationId, params.conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(12),
      getDb()
        .select()
        .from(conversationMemories)
        .where(eq(conversationMemories.conversationId, params.conversationId))
        .orderBy(desc(conversationMemories.updatedAt))
        .limit(1),
      getDb()
        .select()
        .from(userMemories)
        .where(eq(userMemories.userId, params.userId))
        .orderBy(desc(userMemories.updatedAt))
        .limit(8),
    ]);

  const allowVaultContext = userSetting?.allowVaultContext ?? true;
  const allowedCategories = allowVaultContext
    ? (agent.allowedVaultCategories as VaultDocumentCategory[])
    : [];
  const vaultContext = await vaultV2Service.loadContext({
    userId: params.userId,
    allowedCategories,
    query: params.latestUserMessage,
    maxChunks: 4,
  });

  const enabledFormulaTools = buildEnabledFormulaTools({
    allowWebResearch: userSetting?.allowWebResearch ?? false,
    allowScientificResearch: userSetting?.allowScientificResearch ?? false,
    preferKimiMemory: userSetting?.preferKimiMemory ?? false,
    enabledFormulaTools: userSetting?.enabledFormulaTools ?? [],
  });

  return {
    agentDefinitionId: agent.id,
    systemPrompt:
      promptTemplate?.templateText ??
      "You are Generalist, a practical health intelligence assistant for Aura.",
    customContext: userSetting?.customContext ?? null,
    trainingNotes: userSetting?.trainingNotes ?? null,
    responseStyle: userSetting?.responseStyle ?? "detailed",
    recentMessages: recentMessages.reverse(),
    conversationSummary: latestSummary[0]?.summary ?? null,
    longTermMemories: memories.map(memory => ({
      key: memory.memoryKey,
      value: memory.value,
      confidence:
        memory.confidence === null || memory.confidence === undefined
          ? null
          : Number(memory.confidence),
    })),
    clinicalProfileSummary: vaultContext.clinicalProfileSummary,
    selectedVaultChunks: vaultContext.selectedVaultChunks,
    relatedVaultDocuments: vaultContext.relatedVaultDocuments,
    enabledFormulaTools,
    thinkingMode: resolveDefaultKimiThinkingMode({
      agentSlug: params.agentSlug,
      medicalMode: params.medicalMode,
      explicitThinkingMode: userSetting?.kimiThinkingMode ?? null,
    }),
    promptCacheKey: `kimi:v2:conversation:${params.conversationId}`,
    safetyIdentifier: `user-${params.userId}`,
  };
}

function buildEnabledFormulaTools(input: {
  allowWebResearch: boolean;
  allowScientificResearch: boolean;
  preferKimiMemory: boolean;
  enabledFormulaTools: string[];
}) {
  const defaults: string[] = [];

  if (input.preferKimiMemory) {
    defaults.push("moonshot/memory:latest");
  }
  if (input.allowWebResearch) {
    defaults.push("moonshot/web-search:latest");
  }
  if (input.allowScientificResearch) {
    defaults.push("moonshot/rethink:latest");
  }

  return Array.from(new Set([...defaults, ...input.enabledFormulaTools]));
}

function resolveDefaultKimiThinkingMode(input: {
  agentSlug: string;
  medicalMode?: "personal-health" | "research";
  explicitThinkingMode?: "enabled" | "disabled" | null;
}) {
  if (input.explicitThinkingMode) {
    return input.explicitThinkingMode;
  }

  if (
    input.medicalMode === "research" ||
    input.agentSlug === "research-synthesizer"
  ) {
    return "enabled" as const;
  }

  return "disabled" as const;
}

export { buildEnabledFormulaTools, resolveDefaultKimiThinkingMode };

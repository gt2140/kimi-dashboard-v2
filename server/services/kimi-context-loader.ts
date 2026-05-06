import { and, desc, eq, inArray } from "drizzle-orm";
import {
  conversationMemories,
  messages,
  userMemories,
  vaultChunks,
  vaultFiles,
} from "../../db/schema.js";
import { getDb } from "../queries/connection.js";
import { getActiveSystemPrompt, getAgentDefinitionBySlug, getUserAgentSetting } from "../queries/agents.js";
import { buildVaultChunks, selectVaultChunksForPrompt } from "./kimi-vault.js";

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
    ? (agent.allowedVaultCategories as Array<(typeof vaultFiles.$inferSelect)["category"]>)
    : [];

  const files =
    allowedCategories.length === 0
      ? []
      : await getDb()
          .select()
          .from(vaultFiles)
          .where(
            and(
              eq(vaultFiles.userId, params.userId),
              inArray(vaultFiles.category, allowedCategories),
              eq(vaultFiles.extractionStatus, "ready"),
            ),
          )
          .orderBy(desc(vaultFiles.updatedAt))
          .limit(6);

  const fileChunks = await loadVaultChunks(files);
  const selectedVaultChunks = selectVaultChunksForPrompt({
    query: params.latestUserMessage,
    chunks: fileChunks,
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
    selectedVaultChunks,
    relatedVaultFiles: files.map(file => file.filename),
    enabledFormulaTools,
    thinkingMode: resolveDefaultKimiThinkingMode({
      agentSlug: params.agentSlug,
      medicalMode: params.medicalMode,
      explicitThinkingMode: userSetting?.kimiThinkingMode ?? null,
    }),
    promptCacheKey: `kimi:v1:conversation:${params.conversationId}`,
    safetyIdentifier: `user-${params.userId}`,
  };
}

async function loadVaultChunks(
  files: Array<{
    id: number;
    extractedText: string | null;
  }>,
) {
  if (files.length === 0) {
    return [];
  }

  const storedChunks = await getDb()
    .select()
    .from(vaultChunks)
    .where(
      inArray(
        vaultChunks.vaultFileId,
        files.map(file => file.id),
      ),
    );

  if (storedChunks.length > 0) {
    return storedChunks.map(chunk => ({
      vaultFileId: chunk.vaultFileId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
    }));
  }

  return files.flatMap(file =>
    buildVaultChunks({
      vaultFileId: file.id,
      content: file.extractedText ?? "",
    }),
  );
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

  if (input.medicalMode === "research" || input.agentSlug === "research-synthesizer") {
    return "enabled" as const;
  }

  return "disabled" as const;
}

export { buildEnabledFormulaTools, resolveDefaultKimiThinkingMode };

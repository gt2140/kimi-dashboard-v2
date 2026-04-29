import {
  getAgentDefinitionBySlug,
  getUserAgentSetting,
  ensureConversationalCatalogSeeded,
} from "../queries/agents.js";

export async function resolveAgentExecutionProfile(params: {
  userId: number;
  slug: string;
}) {
  await ensureConversationalCatalogSeeded();

  const agent = await getAgentDefinitionBySlug(params.slug);
  if (!agent) {
    throw new Error(`Agent ${params.slug} not found`);
  }

  const userSetting = await getUserAgentSetting(params.userId, agent.id);

  return {
    agent,
    userSetting,
    resolved: {
      providerId: userSetting?.preferredProviderId ?? agent.defaultProviderId ?? null,
      modelId: userSetting?.preferredModelId ?? agent.defaultModelId ?? null,
      customContext: userSetting?.customContext ?? null,
      trainingNotes: userSetting?.trainingNotes ?? null,
      allowVaultContext: userSetting?.allowVaultContext ?? true,
      allowWebResearch: userSetting?.allowWebResearch ?? true,
      allowScientificResearch: userSetting?.allowScientificResearch ?? false,
      responseStyle: userSetting?.responseStyle ?? "detailed",
      allowedVaultCategories: agent.allowedVaultCategories,
      capabilities: agent.capabilities,
    },
  };
}

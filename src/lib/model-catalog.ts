import type { ChatModelProviderSlug as ContractChatModelProviderSlug } from "@contracts/chat-models";

export type ChatModelProviderSlug = Exclude<
  ContractChatModelProviderSlug,
  "kimi"
>;

export type CuratedTextModelOption = {
  providerSlug: ChatModelProviderSlug;
  modelName: string | null;
  displayName: string;
  providerLabel: string;
  modelId: string | null;
  contextWindow: string;
  badges: string[];
  supportsReasoning: boolean;
  supportsVision: boolean;
  supportsCode: boolean;
  isDefaultCandidate: boolean;
};

export const CURATED_TEXT_MODELS: CuratedTextModelOption[] = [
  {
    providerSlug: "auto",
    modelName: null,
    displayName: "Auto",
    providerLabel: "Aura",
    modelId: null,
    contextWindow: "Venice default",
    badges: ["Recommended", "Venice default"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: true,
  },
  {
    providerSlug: "venice",
    modelName: "zai-org-glm-5-1",
    displayName: "GLM 5.1",
    providerLabel: "Venice",
    modelId: "zai-org-glm-5-1",
    contextWindow: "200K",
    badges: ["Private", "Beta", "Reasoning"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: true,
  },
  {
    providerSlug: "venice",
    modelName: "z-ai-glm-5-turbo",
    displayName: "GLM 5 Turbo",
    providerLabel: "Venice",
    modelId: "z-ai-glm-5-turbo",
    contextWindow: "200K",
    badges: ["Anonymized"],
    supportsReasoning: false,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "olafangensan-glm-4.7-flash-heretic",
    displayName: "GLM 4.7 Flash Heretic",
    providerLabel: "Venice",
    modelId: "olafangensan-glm-4.7-flash-heretic",
    contextWindow: "200K",
    badges: ["Private", "Uncensored"],
    supportsReasoning: false,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "venice-uncensored-1-2",
    displayName: "Venice Uncensored 1.2",
    providerLabel: "Venice",
    modelId: "venice-uncensored-1-2",
    contextWindow: "128K",
    badges: ["Private", "Uncensored"],
    supportsReasoning: false,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "qwen-3-6-plus",
    displayName: "Qwen 3.6 Plus Uncensored",
    providerLabel: "Venice",
    modelId: "qwen-3-6-plus",
    contextWindow: "1M",
    badges: ["Anonymized", "Beta", "Uncensored", "Reasoning"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    providerLabel: "Venice",
    modelId: "claude-sonnet-4-6",
    contextWindow: "1M",
    badges: ["Anonymized", "Beta", "Reasoning", "Code"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "openai-gpt-55",
    displayName: "GPT-5.5",
    providerLabel: "Venice",
    modelId: "openai-gpt-55",
    contextWindow: "1M",
    badges: ["Anonymized", "Beta", "Reasoning", "Code"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash",
    providerLabel: "Venice",
    modelId: "deepseek-v4-flash",
    contextWindow: "1M",
    badges: ["Anonymized"],
    supportsReasoning: false,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "kimi-k2-6",
    displayName: "Kimi K2.6",
    providerLabel: "Venice",
    modelId: "kimi-k2-6",
    contextWindow: "256K",
    badges: ["Private", "Reasoning"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
];

export function filterCuratedTextModels(
  query: string,
  models: CuratedTextModelOption[] = CURATED_TEXT_MODELS,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return models;
  }

  return models.filter(model =>
    [
      model.displayName,
      model.providerLabel,
      model.modelId ?? "",
      model.contextWindow,
      ...model.badges,
    ].some(value => value.toLowerCase().includes(normalizedQuery)),
  );
}

export function getSelectedModelOption(
  providerSlug: ChatModelProviderSlug,
  modelName: string | null,
  models: CuratedTextModelOption[] = CURATED_TEXT_MODELS,
) {
  if (providerSlug === "auto") {
    return models[0] ?? CURATED_TEXT_MODELS[0];
  }

  const selectedModel = models.find(
    model =>
      model.providerSlug === providerSlug &&
      model.modelName === modelName,
  );

  if (selectedModel) {
    return selectedModel;
  }

  return {
    providerSlug,
    modelName,
    displayName: modelName ?? "Unknown model",
    providerLabel: providerSlug === "venice" ? "Venice" : "Provider",
    modelId: modelName,
    contextWindow: "Unknown",
    badges: ["Unavailable"],
    supportsReasoning: false,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  } satisfies CuratedTextModelOption;
}

export function resolveRuntimeModelSelection(
  providerSlug: ChatModelProviderSlug,
  modelName: string | null,
) {
  if (providerSlug === "auto") {
    return {
      requestedModelName: undefined,
    };
  }

  return {
    requestedModelName:
      providerSlug === "venice" ? (modelName ?? undefined) : undefined,
  };
}

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
    modelName: "zai-org-glm-5",
    displayName: "GLM 5",
    providerLabel: "Venice",
    modelId: "zai-org-glm-5",
    contextWindow: "198K",
    badges: ["Private", "Reasoning"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: true,
  },
  {
    providerSlug: "venice",
    modelName: "claude-opus-4-7-fast",
    displayName: "Claude Opus 4.7 Fast",
    providerLabel: "Venice",
    modelId: "claude-opus-4-7-fast",
    contextWindow: "1M",
    badges: ["Anon", "Fast", "Reasoning", "Code"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    providerLabel: "Venice",
    modelId: "deepseek-v4-pro",
    contextWindow: "1M",
    badges: ["Anon", "Reasoning", "Code"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "openai-gpt-55-pro",
    displayName: "GPT-5.5 Pro",
    providerLabel: "Venice",
    modelId: "openai-gpt-55-pro",
    contextWindow: "1M+",
    badges: ["Anon", "Reasoning", "Vision"],
    supportsReasoning: true,
    supportsVision: true,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "qwen3-6-27b",
    displayName: "Qwen 3.6 27B",
    providerLabel: "Venice",
    modelId: "qwen3-6-27b",
    contextWindow: "Unknown",
    badges: ["Private", "Vision", "Code"],
    supportsReasoning: true,
    supportsVision: true,
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
    badges: ["Anon", "Fast", "Reasoning", "Code"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "e2ee-glm-5-1",
    displayName: "GLM 5.1 E2EE",
    providerLabel: "Venice",
    modelId: "e2ee-glm-5-1",
    contextWindow: "Unknown",
    badges: ["TEE", "E2EE", "Private"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "openai-gpt-55",
    displayName: "GPT-5.5",
    providerLabel: "Venice",
    modelId: "openai-gpt-55",
    contextWindow: "1M+",
    badges: ["Anon", "Reasoning"],
    supportsReasoning: true,
    supportsVision: true,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "kimi-k2-6",
    displayName: "Kimi K2.6",
    providerLabel: "Venice",
    modelId: "kimi-k2-6",
    contextWindow: "256K",
    badges: ["Private", "Code"],
    supportsReasoning: true,
    supportsVision: true,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "grok-4-3",
    displayName: "Grok 4.3",
    providerLabel: "Venice",
    modelId: "grok-4-3",
    contextWindow: "1M",
    badges: ["Private", "Reasoning"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "claude-opus-4-7",
    displayName: "Claude Opus 4.7",
    providerLabel: "Venice",
    modelId: "claude-opus-4-7",
    contextWindow: "1M",
    badges: ["Anon", "Reasoning", "Code"],
    supportsReasoning: true,
    supportsVision: true,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "gemma-4-uncensored",
    displayName: "Gemma 4 Uncensored",
    providerLabel: "Venice",
    modelId: "gemma-4-uncensored",
    contextWindow: "256K",
    badges: ["Private", "Uncensored", "Code"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "claude-opus-4-6-fast",
    displayName: "Claude Opus 4.6 Fast",
    providerLabel: "Venice",
    modelId: "claude-opus-4-6-fast",
    contextWindow: "1M",
    badges: ["Anon", "Fast", "Reasoning", "Code"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "zai-org-glm-5-1",
    displayName: "GLM 5.1",
    providerLabel: "Venice",
    modelId: "zai-org-glm-5-1",
    contextWindow: "Unknown",
    badges: ["Private", "Reasoning"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: true,
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
    modelName: "openai-gpt-54-mini",
    displayName: "GPT-5.4 Mini",
    providerLabel: "Venice",
    modelId: "openai-gpt-54-mini",
    contextWindow: "Unknown",
    badges: ["Anon", "Fast", "Reasoning", "Vision"],
    supportsReasoning: true,
    supportsVision: true,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "aion-labs-aion-2-0",
    displayName: "Aion 2.0",
    providerLabel: "Venice",
    modelId: "aion-labs-aion-2-0",
    contextWindow: "Unknown",
    badges: ["Anon", "Uncensored", "Creative"],
    supportsReasoning: false,
    supportsVision: false,
    supportsCode: false,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "minimax-m27",
    displayName: "MiniMax M2.7",
    providerLabel: "Venice",
    modelId: "minimax-m27",
    contextWindow: "Unknown",
    badges: ["Anon", "Agentic"],
    supportsReasoning: true,
    supportsVision: false,
    supportsCode: true,
    isDefaultCandidate: false,
  },
  {
    providerSlug: "venice",
    modelName: "grok-4-20",
    displayName: "Grok 4.20",
    providerLabel: "Venice",
    modelId: "grok-4-20",
    contextWindow: "Unknown",
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

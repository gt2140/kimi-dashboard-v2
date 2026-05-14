export type ChatModelProviderSlug = "auto" | "openai" | "venice" | "kimi";

export type ChatModelSelection = {
  providerSlug: ChatModelProviderSlug;
  modelName?: string | null;
};

export type LiveChatModelProviderSlug = Exclude<ChatModelProviderSlug, "auto">;

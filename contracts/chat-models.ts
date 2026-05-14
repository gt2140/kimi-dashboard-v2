export type ChatModelProviderSlug = "auto" | "venice";

export type ChatModelSelection = {
  providerSlug: ChatModelProviderSlug;
  modelName?: string | null;
};

export type LiveChatModelProviderSlug = Exclude<ChatModelProviderSlug, "auto">;

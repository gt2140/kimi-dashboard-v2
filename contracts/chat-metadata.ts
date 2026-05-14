import type { AuraMedicalMode, AuraPolicyLevel, AuraRuntimeVersion } from "./aura-runtime";
import type { ChatModelProviderSlug } from "./chat-models";

export type ChatResponseMode = "model" | "limited";

export type ChatAssistantMetadata = {
  engine?: "aura-chat-v1" | "aura-multi-provider-v1" | "kimi-v1";
  providerSlug?: ChatModelProviderSlug | string;
  modelName?: string;
  requestedProviderSlug?: ChatModelProviderSlug | string;
  requestedModelName?: string | null;
  runtimeVersion?: AuraRuntimeVersion;
  medicalMode?: AuraMedicalMode;
  policyLevel?: AuraPolicyLevel;
  responseMode?: ChatResponseMode;
  relatedVaultFiles?: string[];
  contextSummary?: string;
  inputTokens?: number;
  outputTokens?: number;
  executionNotes?: string[];
  fallbackReason?: string;
  providerMetadata?: Record<string, unknown>;
};

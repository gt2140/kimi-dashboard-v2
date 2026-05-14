import type {
  AuraMedicalMode,
  AuraPolicyLevel,
  AuraRuntimeOptions,
  AuraRuntimeVersion,
} from "../../contracts/aura-runtime.js";
import {
  buildAuraMedicalMetadata,
  buildAuraMedicalPromptAddendum,
  buildAuraMedicalStageLabels,
  buildAuraMedicalToolPreferences,
  resolveAuraRuntimeOptions,
} from "./aura-medical-runtime.js";
import { loadKimiTurnContext } from "./kimi-context-loader.js";

export async function loadAuraMedicalTurnContext(params: {
  userId: number;
  conversationId: number;
  agentSlug: string;
  latestUserMessage: string;
  runtimeVersion?: AuraRuntimeVersion;
  medicalMode?: AuraMedicalMode;
  policyLevel?: AuraPolicyLevel;
  runtimeOptions?: Partial<AuraRuntimeOptions>;
}) {
  const base = await loadKimiTurnContext(params);
  const runtimeOptions = resolveAuraRuntimeOptions({
    runtimeVersion: params.runtimeVersion,
    medicalMode: params.medicalMode,
    policyLevel: params.policyLevel,
    ...(params.runtimeOptions ?? {}),
  });

  return {
    ...base,
    systemPrompt: [
      base.systemPrompt,
      buildAuraMedicalPromptAddendum({
        medicalMode: runtimeOptions.medicalMode,
        policyLevel: runtimeOptions.policyLevel,
      }),
    ].join("\n\n"),
    enabledFormulaTools: buildAuraMedicalToolPreferences({
      enabledFormulaTools: base.enabledFormulaTools,
      medicalMode: runtimeOptions.medicalMode,
    }),
    promptCacheKey: `aura-medical:v1:${runtimeOptions.medicalMode}:conversation:${params.conversationId}`,
    stageLabels: buildAuraMedicalStageLabels({
      medicalMode: runtimeOptions.medicalMode,
      latestUserMessage: params.latestUserMessage,
    }),
    runtimeMetadata: buildAuraMedicalMetadata({
      runtimeOptions,
      toolResults: [],
    }),
  };
}

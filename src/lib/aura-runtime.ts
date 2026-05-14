import type {
  AuraMedicalMode,
  AuraPolicyLevel,
  AuraRuntimeOptions,
  AuraRuntimeVersion,
} from "@contracts/aura-runtime";

const DEFAULT_AURA_RUNTIME_OPTIONS: AuraRuntimeOptions = {
  runtimeVersion: "aura-medical-v1",
  medicalMode: "personal-health",
  policyLevel: "interpretive-on-request",
};

export function resolveAuraRuntimeOptions(input: Partial<AuraRuntimeOptions>) {
  const runtimeVersion: AuraRuntimeVersion = "aura-medical-v1";
  const medicalMode: AuraMedicalMode =
    input.medicalMode === "research" ? "research" : "personal-health";
  const policyLevel: AuraPolicyLevel = "interpretive-on-request";

  return {
    ...DEFAULT_AURA_RUNTIME_OPTIONS,
    runtimeVersion,
    medicalMode,
    policyLevel,
  };
}

export function resolveAuraRuntimeEndpoint(input: Partial<AuraRuntimeOptions>) {
  resolveAuraRuntimeOptions(input);
  return "/api/chat/stream";
}

export { DEFAULT_AURA_RUNTIME_OPTIONS };

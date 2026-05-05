export const AURA_RUNTIME_VERSIONS = ["classic", "aura-medical-v1"] as const;
export const AURA_MEDICAL_MODES = ["personal-health", "research"] as const;
export const AURA_POLICY_LEVELS = ["interpretive-on-request"] as const;

export type AuraRuntimeVersion = (typeof AURA_RUNTIME_VERSIONS)[number];
export type AuraMedicalMode = (typeof AURA_MEDICAL_MODES)[number];
export type AuraPolicyLevel = (typeof AURA_POLICY_LEVELS)[number];

export type AuraRuntimeOptions = {
  runtimeVersion: AuraRuntimeVersion;
  medicalMode: AuraMedicalMode;
  policyLevel: AuraPolicyLevel;
};

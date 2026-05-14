import type {
  AuraMedicalMode,
  AuraPolicyLevel,
  AuraRuntimeOptions,
  AuraRuntimeVersion,
} from "../../contracts/aura-runtime.js";

type ToolResult = {
  toolCallId: string;
  toolName: string;
  content: string;
};

type EvidenceSource = "pubmed" | "clinicaltrials";

type AuraMedicalEvidence = {
  source: EvidenceSource;
  title: string;
  url: string;
  citation?: string;
};

const DEFAULT_AURA_RUNTIME_OPTIONS: AuraRuntimeOptions = {
  runtimeVersion: "aura-medical-v1",
  medicalMode: "personal-health",
  policyLevel: "interpretive-on-request",
};

export function resolveAuraRuntimeOptions(
  input: Partial<AuraRuntimeOptions>,
): AuraRuntimeOptions {
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

export function buildAuraMedicalPromptAddendum(input: {
  medicalMode: AuraMedicalMode;
  policyLevel: AuraPolicyLevel;
}) {
  const policyInstruction =
    input.policyLevel === "interpretive-on-request"
      ? "Stay conservative by default. Move into interpretive health guidance only when the user explicitly asks for it, and clearly separate observations, evidence, and hypotheses."
      : "Stay conservative and evidence-bound.";

  if (input.medicalMode === "research") {
    return [
      "Aura Medical Runtime V1 is active in research mode.",
      "Prioritize higher-quality evidence such as systematic reviews, meta-analyses, randomized trials, and well-conducted cohort studies before weaker evidence.",
      "Identify the likely study type, note methodological limits, and call out important evidence gaps or uncertainty.",
      policyInstruction,
    ].join("\n");
  }

  return [
    "Aura Medical Runtime V1 is active in personal-health mode.",
    "Blend the user's vault context, biomarker history, and recent evidence without turning into generic wellness advice.",
    "When research is relevant, summarize it in plain language and tie it back to the user's context cautiously.",
    policyInstruction,
  ].join("\n");
}

export function buildAuraMedicalToolPreferences(input: {
  enabledFormulaTools: string[];
  medicalMode: AuraMedicalMode;
}) {
  if (input.medicalMode === "personal-health") {
    return [];
  }

  const tools = [...input.enabledFormulaTools];

  if (
    input.medicalMode === "research" &&
    !tools.includes("moonshot/web-search:latest")
  ) {
    tools.push("moonshot/web-search:latest");
  }

  if (
    input.medicalMode === "research" &&
    !tools.includes("moonshot/rethink:latest")
  ) {
    tools.push("moonshot/rethink:latest");
  }

  return Array.from(new Set(tools));
}

export function buildAuraMedicalStageLabels(input: {
  medicalMode: AuraMedicalMode;
  latestUserMessage?: string;
  requestedProviderSlug?: string | null;
  requestedModelName?: string | null;
}) {
  const normalizedMessage = input.latestUserMessage?.toLowerCase() ?? "";
  const isVaultFocused =
    normalizedMessage.includes("vault") ||
    normalizedMessage.includes("pdf") ||
    normalizedMessage.includes("bloodwork") ||
    normalizedMessage.includes("lab") ||
    normalizedMessage.includes("study") ||
    normalizedMessage.includes("upload");
  const isEvidenceFocused =
    normalizedMessage.includes("evidence") ||
    normalizedMessage.includes("pubmed") ||
    normalizedMessage.includes("trial") ||
    normalizedMessage.includes("research") ||
    normalizedMessage.includes("paper");
  const providerLabel =
    input.requestedProviderSlug === "venice"
      ? "Venice"
      : input.requestedProviderSlug === "openai"
        ? "OpenAI"
        : "Aura";

  if (input.medicalMode === "research") {
    return {
      memory: isEvidenceFocused
        ? "Reviewing prior context and research focus"
        : "Reviewing context and evidence goals",
      analyze: "Checking evidence quality and retrieval plan",
      tools: "Collecting research evidence",
      draft:
        providerLabel === "Aura"
          ? "Writing the evidence synthesis"
          : `Writing the evidence synthesis with ${providerLabel}`,
    };
  }

  return {
    memory: isVaultFocused
      ? "Reviewing your vault context and recent history"
      : "Reviewing your context and recent history",
    analyze: isVaultFocused
      ? "Checking biomarkers, notes, and uploaded context"
      : "Reviewing the question and next best context",
    tools: "Collecting supporting evidence",
    draft:
      providerLabel === "Aura"
        ? "Writing the health summary"
        : `Drafting the answer with ${providerLabel}`,
  };
}

export function buildAuraMedicalMetadata(input: {
  runtimeOptions: AuraRuntimeOptions;
  toolResults: ToolResult[];
}) {
  const evidence = extractAuraMedicalEvidence(input.toolResults);

  return {
    runtimeVersion: input.runtimeOptions.runtimeVersion,
    medicalMode: input.runtimeOptions.medicalMode,
    policyLevel: input.runtimeOptions.policyLevel,
    reasoningProfile:
      input.runtimeOptions.medicalMode === "research"
        ? "evidence-insights"
        : "personal-health",
    researchEvidence: evidence,
  };
}

export function extractAuraMedicalEvidence(toolResults: ToolResult[]) {
  const evidence: AuraMedicalEvidence[] = [];
  const seen = new Set<string>();

  for (const result of toolResults) {
    const lines = result.content
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const source = detectEvidenceSource(line);
      if (!source || seen.has(line)) {
        continue;
      }

      seen.add(line);
      const title = lines[index - 1] ?? `Evidence from ${source}`;
      evidence.push({
        source,
        title,
        url: line,
      });
    }
  }

  return evidence;
}

function detectEvidenceSource(value: string): EvidenceSource | null {
  if (/https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/?/i.test(value)) {
    return "pubmed";
  }

  if (/https?:\/\/clinicaltrials\.gov\/study\/[A-Za-z0-9-]+/i.test(value)) {
    return "clinicaltrials";
  }

  return null;
}

export type { AuraMedicalEvidence };

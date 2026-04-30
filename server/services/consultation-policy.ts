import { AGENTS } from "../../src/lib/data.js";

type ConsultationMode = "none" | "explicit" | "auto";

type ResolveConsultationPlanInput = {
  primaryAgentSlug: string;
  availableSupportingAgentSlugs: string[];
  userMessage: string;
};

type ConsultationPlan = {
  mode: ConsultationMode;
  explicitMentionedAgentSlugs: string[];
  autoConsultedAgentSlugs: string[];
  consultedAgentSlugs: string[];
  rationale: string | null;
};

const AUTO_CONSULT_LIMIT = 2;

const ROUTING_HINTS: Record<string, string[]> = {
  bloodwork: [
    "blood",
    "bloodwork",
    "panel",
    "cbc",
    "cmp",
    "ldl",
    "hdl",
    "apob",
    "cholesterol",
    "triglycerides",
    "ferritin",
    "hs-crp",
    "homocysteine",
    "glucose",
    "insulin",
    "thyroid",
    "hormone",
  ],
  nutrition: [
    "diet",
    "nutrition",
    "macro",
    "macros",
    "protein",
    "carbs",
    "meal",
    "meals",
    "calories",
    "fiber",
    "micronutrient",
  ],
  supplements: [
    "supplement",
    "supplements",
    "stack",
    "magnesium",
    "creatine",
    "vitamin",
    "omega",
    "interaction",
    "dose",
    "dosing",
  ],
  peptides: [
    "peptide",
    "peptides",
    "bpc",
    "tb-500",
    "tb500",
    "cjc",
    "ipamorelin",
    "injec",
    "recovery",
  ],
  psychedelics: [
    "psychedelic",
    "psychedelics",
    "microdose",
    "microdosing",
    "psilocybin",
    "lsd",
    "integration",
    "set and setting",
  ],
  "research-synthesizer": [
    "research",
    "evidence",
    "study",
    "studies",
    "pubmed",
    "doi",
    "meta-analysis",
    "trial",
  ],
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s@-]/g, " ");
}

function toMentionToken(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function extractExplicitMentionedAgentSlugs(
  userMessage: string,
  candidateSlugs: string[]
) {
  const normalized = normalizeText(userMessage);

  return candidateSlugs.filter(slug => {
    const agent = AGENTS.find(item => item.id === slug);
    const mentionTokens = unique(
      [slug, agent?.name ?? ""].filter(Boolean).map(toMentionToken)
    );

    return mentionTokens.some(token => normalized.includes(`@${token}`));
  });
}

function getAutoConsultCandidates(params: {
  primaryAgentSlug: string;
  availableSupportingAgentSlugs: string[];
}) {
  const available = unique(
    params.availableSupportingAgentSlugs.filter(
      slug => slug && slug !== params.primaryAgentSlug
    )
  );

  if (available.length > 0) {
    return available;
  }

  return AGENTS.map(agent => agent.id).filter(
    slug => slug !== params.primaryAgentSlug
  );
}

function scoreAgentForMessage(agentSlug: string, normalizedMessage: string) {
  const hints = ROUTING_HINTS[agentSlug] ?? [];
  const agent = AGENTS.find(item => item.id === agentSlug);

  let score = 0;
  const matchedTerms = new Set<string>();

  for (const hint of hints) {
    if (normalizedMessage.includes(hint)) {
      score += 2;
      matchedTerms.add(hint);
    }
  }

  const genericTerms = unique([
    agentSlug,
    agent?.name ?? "",
    ...(agent?.tags ?? []),
    ...(agent?.allowedVaultCategories ?? []),
  ])
    .map(value => normalizeText(value))
    .filter(value => value.length >= 4);

  for (const term of genericTerms) {
    if (normalizedMessage.includes(term)) {
      score += 1;
      matchedTerms.add(term);
    }
  }

  return {
    score,
    matchedTerms: Array.from(matchedTerms),
  };
}

export function resolveConsultationPlan(
  input: ResolveConsultationPlanInput
): ConsultationPlan {
  const normalizedMessage = normalizeText(input.userMessage);
  const explicitMentionedAgentSlugs = extractExplicitMentionedAgentSlugs(
    input.userMessage,
    AGENTS.map(agent => agent.id).filter(slug => slug !== input.primaryAgentSlug)
  );

  if (explicitMentionedAgentSlugs.length > 0) {
    const consultedAgentSlugs = explicitMentionedAgentSlugs.filter(
      slug => slug !== input.primaryAgentSlug
    );

    return {
      mode: consultedAgentSlugs.length > 0 ? "explicit" : "none",
      explicitMentionedAgentSlugs: consultedAgentSlugs,
      autoConsultedAgentSlugs: [],
      consultedAgentSlugs,
      rationale:
        consultedAgentSlugs.length > 0
          ? "You explicitly tagged specialist agents in the message."
          : null,
    };
  }

  if (input.primaryAgentSlug !== "generalist") {
    return {
      mode: "none",
      explicitMentionedAgentSlugs: [],
      autoConsultedAgentSlugs: [],
      consultedAgentSlugs: [],
      rationale: null,
    };
  }

  const scoredCandidates = getAutoConsultCandidates({
    primaryAgentSlug: input.primaryAgentSlug,
    availableSupportingAgentSlugs: input.availableSupportingAgentSlugs,
  })
    .map(slug => ({
      slug,
      ...scoreAgentForMessage(slug, normalizedMessage),
    }))
    .filter(candidate => candidate.score >= 2)
    .sort((left, right) => right.score - left.score)
    .slice(0, AUTO_CONSULT_LIMIT);

  const consultedAgentSlugs = scoredCandidates.map(candidate => candidate.slug);
  const rationale =
    scoredCandidates.length > 0
      ? `Aura auto-consulted specialists because the message matched ${scoredCandidates
          .map(candidate => {
            const agent = AGENTS.find(item => item.id === candidate.slug);
            const matched = candidate.matchedTerms.slice(0, 3).join(", ");
            return matched
              ? `${agent?.name ?? candidate.slug} signals (${matched})`
              : `${agent?.name ?? candidate.slug} signals`;
          })
          .join("; ")}.`
      : null;

  return {
    mode: scoredCandidates.length > 0 ? "auto" : "none",
    explicitMentionedAgentSlugs: [],
    autoConsultedAgentSlugs: consultedAgentSlugs,
    consultedAgentSlugs,
    rationale,
  };
}

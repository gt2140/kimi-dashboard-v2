type PendingTurnStage = {
  id: string;
  label: string;
};

type BuildPendingTurnStagesInput = {
  primaryAgentId: string;
  helperAgentIds: string[];
  userMessage: string;
};

const AUTO_CONSULT_LIMIT = 2;

const TURN_STAGE_COPY: Record<
  string,
  {
    analyze: string;
    context: string;
    draft?: string;
  }
> = {
  generalist: {
    analyze: "Thinking through your question",
    context: "Checking your context",
    draft: "Writing the reply",
  },
  bloodwork: {
    analyze: "Checking marker patterns",
    context: "Checking lab context",
    draft: "Writing the lab summary",
  },
  nutrition: {
    analyze: "Looking at intake and metabolism",
    context: "Checking nutrition context",
    draft: "Writing the nutrition summary",
  },
  supplements: {
    analyze: "Reviewing stack and interactions",
    context: "Checking supplement context",
    draft: "Writing the recommendation",
  },
  peptides: {
    analyze: "Checking protocol and safety",
    context: "Checking peptide context",
    draft: "Writing the protocol notes",
  },
  psychedelics: {
    analyze: "Reviewing safety and setting",
    context: "Checking mental health context",
    draft: "Writing the guidance",
  },
};

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
    "hs crp",
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
    "tb 500",
    "tb500",
    "cjc",
    "ipamorelin",
    "inject",
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
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ");
}

function toTitleCase(value: string) {
  return value
    .split("-")
    .map(part => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function predictSupportingAgentIds(input: BuildPendingTurnStagesInput) {
  if (input.helperAgentIds.length > 0) {
    return input.helperAgentIds;
  }

  if (input.primaryAgentId !== "generalist") {
    return [];
  }

  const normalizedMessage = normalizeText(input.userMessage);

  return Object.entries(ROUTING_HINTS)
    .map(([agentId, hints]) => ({
      agentId,
      score: hints.reduce(
        (total, hint) => (normalizedMessage.includes(hint) ? total + 1 : total),
        0
      ),
    }))
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, AUTO_CONSULT_LIMIT)
    .map(candidate => candidate.agentId);
}

function getTurnStageCopy(primaryAgentId: string) {
  return (
    TURN_STAGE_COPY[primaryAgentId] ?? {
      analyze: "Thinking through your question",
      context: "Checking available context",
      draft: "Writing the reply",
    }
  );
}

export function buildPendingTurnStages(
  input: BuildPendingTurnStagesInput
): PendingTurnStage[] {
  const stageCopy = getTurnStageCopy(input.primaryAgentId);
  const supportingAgentIds = predictSupportingAgentIds(input);

  return [
    {
      id: "analyze",
      label: stageCopy.analyze,
    },
    {
      id: "context",
      label: stageCopy.context,
    },
    ...supportingAgentIds.map(agentId => ({
      id: `consult-${agentId}`,
      label: `Consulting ${toTitleCase(agentId)}`,
    })),
    {
      id: "draft",
      label: stageCopy.draft ?? "Writing the reply",
    },
  ];
}

export function splitMessageForReveal(content: string) {
  const source = content.replace(/\r\n/g, "\n");
  const tokens = source.split(/(\s+)/).filter(Boolean);
  const chunks: string[] = [];

  let buffer = "";
  let visibleCharacters = 0;

  for (const token of tokens) {
    buffer += token;
    visibleCharacters += /\s+/.test(token) ? 0 : token.length;

    const isParagraphBreak = token.includes("\n\n");
    const endsSentence = /[.!?:]\s*$/.test(token);
    const shouldFlush =
      isParagraphBreak ||
      visibleCharacters >= 70 ||
      (visibleCharacters >= 35 && endsSentence);

    if (!shouldFlush) {
      continue;
    }

    chunks.push(buffer);
    buffer = "";
    visibleCharacters = 0;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks.length > 0 ? chunks : [source];
}

export function advanceRevealContent(visibleContent: string, targetContent: string) {
  if (visibleContent.length >= targetContent.length) {
    return targetContent;
  }

  const remaining = targetContent.slice(visibleContent.length);
  const paragraphBreakIndex = remaining.indexOf("\n\n");

  if (paragraphBreakIndex >= 0 && paragraphBreakIndex <= 24) {
    return targetContent.slice(0, visibleContent.length + paragraphBreakIndex + 2);
  }

  const sentenceMatch = remaining.match(/^.{1,32}?[.!?:](?=\s|$)/s);
  if (sentenceMatch) {
    return targetContent.slice(
      0,
      visibleContent.length + sentenceMatch[0].length
    );
  }

  const preferredSlice = remaining.slice(0, 24);
  const wordBoundary = Math.max(
    preferredSlice.lastIndexOf(" "),
    preferredSlice.lastIndexOf("\n")
  );

  if (wordBoundary >= 10) {
    return targetContent.slice(0, visibleContent.length + wordBoundary + 1);
  }

  return targetContent.slice(
    0,
    visibleContent.length + Math.min(12, remaining.length)
  );
}

export type { PendingTurnStage };

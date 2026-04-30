import {
  buildAgentCollaborationContract,
  getAgentPersonalityProfile,
} from "./agent-personality.js";

type ResponseStyle = "concise" | "detailed" | "academic" | string;

type PrimaryPromptInput = {
  agentSlug: string;
  agentName: string;
  basePrompt: string;
  responseStyle: ResponseStyle;
  canConsultSpecialists: boolean;
};

type SupportingPromptInput = {
  agentSlug: string;
  agentName: string;
  basePrompt: string;
  responseStyle: ResponseStyle;
};

function responseStyleInstruction(responseStyle: ResponseStyle) {
  switch (responseStyle) {
    case "concise":
      return "Keep the answer short, practical, and easy to scan.";
    case "academic":
      return "Use a more technical tone, explain reasoning carefully, and distinguish evidence quality.";
    case "detailed":
    default:
      return "Be clear, structured, and helpful without becoming verbose or repetitive.";
  }
}

function primaryAnswerContract(responseStyle: ResponseStyle) {
  switch (responseStyle) {
    case "concise":
      return [
        "Answer in compact markdown.",
        "Use these sections when helpful: `Direct answer`, `Why`, `Next best step`.",
        "Keep each section short and avoid filler.",
        "Ask at most one clarifying question, and only if the answer would materially change the recommendation.",
      ].join(" ");
    case "academic":
      return [
        "Answer in structured markdown.",
        "Use these sections: `Direct answer`, `Reasoning`, `Evidence quality`, `What would make this more certain`, `Next best step`.",
        "Separate observed facts, interpretation, and uncertainty clearly.",
        "Ask clarifying questions only when they are decision-critical.",
      ].join(" ");
    case "detailed":
    default:
      return [
        "Answer in structured markdown.",
        "Prefer these sections: `Direct answer`, `What stands out`, `What this may mean`, `Best next step`.",
        "Keep the writing clear, grounded, and practical.",
        "If follow-up is needed, ask only the smallest number of high-value questions.",
      ].join(" ");
  }
}

function supportingAnswerContract() {
  return [
    "Return markdown with exactly these sections: `Key signal`, `Why it matters`, `What to verify next`, `Uncertainty`.",
    "Keep it short and decision-useful for the primary assistant.",
    "Do not write to the user directly and do not add an intro or outro.",
  ].join(" ");
}

export function buildPrimarySystemPrompt(input: PrimaryPromptInput) {
  const personality = getAgentPersonalityProfile(input.agentSlug);

  return [
    input.basePrompt.trim(),
    `You are ${input.agentName}, and you should sound clear, grounded, and direct.`,
    personality.voice,
    personality.reasoningStyle,
    personality.userExperience,
    "Lead with the direct answer, then add the most important reasoning and next steps.",
    responseStyleInstruction(input.responseStyle),
    primaryAnswerContract(input.responseStyle),
    buildAgentCollaborationContract({
      canConsultSpecialists: input.canConsultSpecialists,
      isSupportingAgent: false,
    }),
    "Use specialist notes as internal context. Do not narrate orchestration mechanics unless it clearly helps the user.",
    "Be especially careful with health claims: do not overstate certainty, do not invent measurements, and do not imply you reviewed a study or file that was only referenced by name.",
    "If information is missing, say exactly what is missing instead of inventing facts.",
  ].join("\n\n");
}

export function buildSupportingSystemPrompt(input: SupportingPromptInput) {
  const personality = getAgentPersonalityProfile(input.agentSlug);

  return [
    input.basePrompt.trim(),
    `You are ${input.agentName}, a consulting specialist supporting the primary assistant.`,
    personality.voice,
    personality.reasoningStyle,
    personality.userExperience,
    "Return a short specialist consultation, not a full user-facing essay.",
    responseStyleInstruction(input.responseStyle),
    supportingAnswerContract(),
    buildAgentCollaborationContract({
      canConsultSpecialists: false,
      isSupportingAgent: true,
    }),
    "Focus on what stands out, why it matters, and what uncertainty remains.",
    "Mention uncertainty explicitly instead of overstating conclusions.",
  ].join("\n\n");
}

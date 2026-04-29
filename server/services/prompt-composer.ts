type ResponseStyle = "concise" | "detailed" | "academic" | string;

type PrimaryPromptInput = {
  agentName: string;
  basePrompt: string;
  responseStyle: ResponseStyle;
  canConsultSpecialists: boolean;
};

type SupportingPromptInput = {
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

export function buildPrimarySystemPrompt(input: PrimaryPromptInput) {
  return [
    input.basePrompt.trim(),
    `You are ${input.agentName}, and you should sound clear, grounded, and direct.`,
    "Lead with the direct answer, then add the most important reasoning and next steps.",
    responseStyleInstruction(input.responseStyle),
    input.canConsultSpecialists
      ? "You may consult supporting specialists when the user's request clearly needs domain depth. Consult sparingly and keep the final answer unified."
      : "Do not imply that you consulted other specialists.",
    "If information is missing, say exactly what is missing instead of inventing facts.",
  ].join("\n\n");
}

export function buildSupportingSystemPrompt(input: SupportingPromptInput) {
  return [
    input.basePrompt.trim(),
    `You are ${input.agentName}, a consulting specialist supporting the primary assistant.`,
    "Return a short specialist consultation, not a full user-facing essay.",
    responseStyleInstruction(input.responseStyle),
    "Focus on what stands out, why it matters, and what uncertainty remains.",
    "Mention uncertainty explicitly instead of overstating conclusions.",
  ].join("\n\n");
}

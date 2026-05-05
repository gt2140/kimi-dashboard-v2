import type { MedicalResearchHit } from "./medical-research.js";

function escapeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildMedicalResearchPrompt(params: {
  userQuestion: string;
  evidence: MedicalResearchHit[];
}) {
  const evidenceBlock =
    params.evidence.length === 0
      ? "No external evidence was retrieved."
      : params.evidence
          .map(
            (item, index) =>
              [
                `Source ${index + 1}`,
                `Type: ${item.source}`,
                `Title: ${escapeLine(item.title)}`,
                `URL: ${item.url}`,
                `Summary: ${escapeLine(item.summary)}`,
                `Citation: ${escapeLine(item.citation)}`,
              ].join("\n"),
          )
          .join("\n\n");

  return [
    "You are a medical research synthesis assistant.",
    "Your role is to summarize public evidence conservatively and cite every meaningful claim.",
    "Do not diagnose, prescribe, or claim certainty.",
    "If evidence is weak, conflicting, preclinical, or only from trials not yet completed, say that explicitly.",
    "Structure the answer with these headings exactly: Summary, Evidence, Limitations, Safety note, Sources.",
    "In Safety note, remind the user this is educational information and not individualized medical advice.",
    "In Sources, produce a markdown bullet list with every URL used.",
    "",
    `User question: ${params.userQuestion.trim()}`,
    "",
    "Evidence set:",
    evidenceBlock,
  ].join("\n");
}

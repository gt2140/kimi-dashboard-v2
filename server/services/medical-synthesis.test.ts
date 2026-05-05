import { describe, expect, it } from "vitest";
import { buildMedicalResearchPrompt } from "./medical-synthesis.js";

describe("buildMedicalResearchPrompt", () => {
  it("includes guardrails, headings, and source material", () => {
    const prompt = buildMedicalResearchPrompt({
      userQuestion: "Does omega-3 help with inflammation?",
      evidence: [
        {
          source: "pubmed",
          title: "Omega-3 and inflammation",
          url: "https://doi.org/10.1000/example",
          summary: "Nutrition Journal, 2025. Smith J et al.",
          citation: "Smith J et al. Omega-3 and inflammation.",
        },
      ],
    });

    expect(prompt).toContain("Do not diagnose, prescribe, or claim certainty.");
    expect(prompt).toContain("Summary, Evidence, Limitations, Safety note, Sources.");
    expect(prompt).toContain("User question: Does omega-3 help with inflammation?");
    expect(prompt).toContain("https://doi.org/10.1000/example");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildAuraMedicalPromptAddendum,
  buildAuraMedicalToolPreferences,
  extractAuraMedicalEvidence,
} from "./aura-medical-runtime.js";

describe("aura medical runtime helpers", () => {
  it("adds evidence-first instructions for research mode", () => {
    expect(
      buildAuraMedicalPromptAddendum({
        medicalMode: "research",
        policyLevel: "interpretive-on-request",
      }),
    ).toContain("Prioritize higher-quality evidence");
  });

  it("adds scientific and web tools for research mode", () => {
    expect(
      buildAuraMedicalToolPreferences({
        enabledFormulaTools: ["moonshot/memory:latest"],
        medicalMode: "research",
      }),
    ).toEqual(
      expect.arrayContaining([
        "moonshot/memory:latest",
        "moonshot/web-search:latest",
        "moonshot/rethink:latest",
      ]),
    );
  });

  it("keeps personal-health mode lightweight by default", () => {
    expect(
      buildAuraMedicalToolPreferences({
        enabledFormulaTools: [
          "moonshot/memory:latest",
          "moonshot/web-search:latest",
          "moonshot/rethink:latest",
        ],
        medicalMode: "personal-health",
      }),
    ).toEqual([]);
  });

  it("extracts PubMed and ClinicalTrials evidence from tool results", () => {
    const evidence = extractAuraMedicalEvidence([
      {
        toolCallId: "tool-1",
        toolName: "web_search",
        content: [
          "ApoB and cardiovascular risk",
          "https://pubmed.ncbi.nlm.nih.gov/39876543/",
          "Lipoprotein(a) trial update",
          "https://clinicaltrials.gov/study/NCT01234567",
        ].join("\n"),
      },
    ]);

    expect(evidence).toEqual([
      expect.objectContaining({
        source: "pubmed",
        url: "https://pubmed.ncbi.nlm.nih.gov/39876543/",
      }),
      expect.objectContaining({
        source: "clinicaltrials",
        url: "https://clinicaltrials.gov/study/NCT01234567",
      }),
    ]);
  });
});

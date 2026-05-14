import { describe, expect, it } from "vitest";
import {
  buildAuraMedicalPromptAddendum,
  buildAuraMedicalStageLabels,
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

  it("personalizes stage labels for vault-heavy questions", () => {
    const labels = buildAuraMedicalStageLabels({
      medicalMode: "personal-health",
      latestUserMessage: "Check my vault PDF and summarize my bloodwork",
      requestedProviderSlug: "venice",
      requestedModelName: "zai-org-glm-5-1",
    });

    expect(labels.memory).toBe("Reviewing your vault context and recent history");
    expect(labels.draft).toBe("Drafting the answer with Venice");
  });

  it("personalizes stage labels for research questions", () => {
    const labels = buildAuraMedicalStageLabels({
      medicalMode: "research",
      latestUserMessage: "Find evidence and PubMed on ApoB targets",
    });

    expect(labels.memory).toBe("Reviewing prior context and research focus");
    expect(labels.tools).toBe("Collecting research evidence");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildPrimarySystemPrompt,
  buildSupportingSystemPrompt,
} from "./prompt-composer.js";

describe("prompt-composer", () => {
  it("builds a primary prompt with character and consultation policy", () => {
    const prompt = buildPrimarySystemPrompt({
      agentSlug: "generalist",
      agentName: "Generalist",
      basePrompt: "You are a general health intelligence agent.",
      responseStyle: "detailed",
      canConsultSpecialists: true,
    });

    expect(prompt).toContain("Generalist");
    expect(prompt).toContain("consult");
    expect(prompt).toContain("clear");
    expect(prompt).toContain("direct answer");
    expect(prompt).toContain("What stands out");
    expect(prompt).toContain("smallest number of high-value questions");
    expect(prompt).toContain("Do not narrate orchestration mechanics");
    expect(prompt).toContain("unified");
  });

  it("builds a specialist prompt optimized for consultation", () => {
    const prompt = buildSupportingSystemPrompt({
      agentSlug: "bloodwork",
      agentName: "Bloodwork",
      basePrompt: "You are a bloodwork specialist.",
      responseStyle: "concise",
    });

    expect(prompt).toContain("Bloodwork");
    expect(prompt).toContain("consulting specialist");
    expect(prompt).toContain("short");
    expect(prompt).toContain("uncertainty");
    expect(prompt).toContain("Key signal");
    expect(prompt).toContain("specialist input");
  });
});

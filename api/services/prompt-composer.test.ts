import { describe, expect, it } from "vitest";
import {
  buildPrimarySystemPrompt,
  buildSupportingSystemPrompt,
} from "./prompt-composer";

describe("prompt-composer", () => {
  it("builds a primary prompt with character and consultation policy", () => {
    const prompt = buildPrimarySystemPrompt({
      agentName: "Generalist",
      basePrompt: "You are a general health intelligence agent.",
      responseStyle: "detailed",
      canConsultSpecialists: true,
    });

    expect(prompt).toContain("Generalist");
    expect(prompt).toContain("consult");
    expect(prompt).toContain("clear");
    expect(prompt).toContain("direct answer");
  });

  it("builds a specialist prompt optimized for consultation", () => {
    const prompt = buildSupportingSystemPrompt({
      agentName: "Bloodwork",
      basePrompt: "You are a bloodwork specialist.",
      responseStyle: "concise",
    });

    expect(prompt).toContain("Bloodwork");
    expect(prompt).toContain("consulting specialist");
    expect(prompt).toContain("short");
    expect(prompt).toContain("uncertainty");
  });
});

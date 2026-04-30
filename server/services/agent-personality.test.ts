import { describe, expect, it } from "vitest";
import {
  buildAgentCollaborationContract,
  getAgentPersonalityProfile,
} from "./agent-personality.js";

describe("agent-personality", () => {
  it("gives the generalist a stable lead voice", () => {
    const profile = getAgentPersonalityProfile("generalist");

    expect(profile.voice).toContain("lead");
    expect(profile.userExperience).toContain("unified");
    expect(profile.reasoningStyle).toContain("synthesize");
  });

  it("gives specialists a scoped contribution style", () => {
    const profile = getAgentPersonalityProfile("bloodwork");

    expect(profile.voice).toContain("specialist");
    expect(profile.userExperience).toContain("precise");
    expect(profile.reasoningStyle).toContain("pattern");
  });

  it("builds different collaboration contracts for lead and supporting agents", () => {
    const lead = buildAgentCollaborationContract({
      canConsultSpecialists: true,
      isSupportingAgent: false,
    });
    const supporting = buildAgentCollaborationContract({
      canConsultSpecialists: false,
      isSupportingAgent: true,
    });

    expect(lead).toContain("unified final answer");
    expect(supporting).toContain("specialist input");
  });

  it("derives a sharper profile for research-oriented marketplace agents", () => {
    const profile = getAgentPersonalityProfile("research-synthesizer");

    expect(profile.voice).toContain("evidence reviewer");
    expect(profile.reasoningStyle).toContain("clinical evidence");
  });
});

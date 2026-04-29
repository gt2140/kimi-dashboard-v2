import { describe, expect, it } from "vitest";
import { resolveConsultationPlan } from "./consultation-policy";

describe("resolveConsultationPlan", () => {
  it("consults only explicitly mentioned agents for non-generalist primaries", () => {
    const result = resolveConsultationPlan({
      primaryAgentSlug: "bloodwork",
      availableSupportingAgentSlugs: ["nutrition", "supplements"],
      userMessage: "@nutrition compare my ferritin with my diet",
    });

    expect(result.mode).toBe("explicit");
    expect(result.consultedAgentSlugs).toEqual(["nutrition"]);
    expect(result.explicitMentionedAgentSlugs).toEqual(["nutrition"]);
  });

  it("auto-consults a specialist for a strongly matched generalist request", () => {
    const result = resolveConsultationPlan({
      primaryAgentSlug: "generalist",
      availableSupportingAgentSlugs: [],
      userMessage:
        "My ApoB, LDL and ferritin changed a lot. Help me understand this blood panel.",
    });

    expect(result.mode).toBe("auto");
    expect(result.consultedAgentSlugs).toContain("bloodwork");
  });

  it("prefers explicit mentions over automatic routing", () => {
    const result = resolveConsultationPlan({
      primaryAgentSlug: "generalist",
      availableSupportingAgentSlugs: ["nutrition", "bloodwork", "supplements"],
      userMessage:
        "@nutrition help me review protein intake and macros with these lipid results",
    });

    expect(result.mode).toBe("explicit");
    expect(result.consultedAgentSlugs).toEqual(["nutrition"]);
    expect(result.autoConsultedAgentSlugs).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  getCanonicalAgentSlugs,
  isConversationalCatalogReadyFromCounts,
} from "./agents.js";
import { AGENTS } from "../../src/lib/data.js";

describe("isConversationalCatalogReadyFromCounts", () => {
  it("returns true when all required seed groups are already present", () => {
    expect(
      isConversationalCatalogReadyFromCounts({
        providerCount: 5,
        agentCount: AGENTS.length,
        promptCount: AGENTS.length,
      })
    ).toBe(true);
  });

  it("returns false when any required seed group is incomplete", () => {
    expect(
      isConversationalCatalogReadyFromCounts({
        providerCount: 3,
        agentCount: AGENTS.length,
        promptCount: AGENTS.length,
      })
    ).toBe(false);

    expect(
      isConversationalCatalogReadyFromCounts({
        providerCount: 5,
        agentCount: AGENTS.length - 1,
        promptCount: AGENTS.length,
      })
    ).toBe(false);

    expect(
      isConversationalCatalogReadyFromCounts({
        providerCount: 5,
        agentCount: AGENTS.length,
        promptCount: AGENTS.length - 1,
      })
    ).toBe(false);
  });
});

describe("getCanonicalAgentSlugs", () => {
  it("returns only the dashboard agents we keep in the final catalog", () => {
    expect(getCanonicalAgentSlugs()).toEqual([
      "generalist",
      "bloodwork",
      "nutrition",
      "supplements",
      "peptides",
      "psychedelics",
      "diagnostic-validator",
      "research-synthesizer",
    ]);
  });
});

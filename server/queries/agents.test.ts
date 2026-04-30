import { describe, expect, it } from "vitest";
import { isConversationalCatalogReadyFromCounts } from "./agents.js";
import { AGENTS } from "../../src/lib/data.js";

describe("isConversationalCatalogReadyFromCounts", () => {
  it("returns true when all required seed groups are already present", () => {
    expect(
      isConversationalCatalogReadyFromCounts({
        providerCount: 4,
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
        providerCount: 4,
        agentCount: AGENTS.length - 1,
        promptCount: AGENTS.length,
      })
    ).toBe(false);

    expect(
      isConversationalCatalogReadyFromCounts({
        providerCount: 4,
        agentCount: AGENTS.length,
        promptCount: AGENTS.length - 1,
      })
    ).toBe(false);
  });
});

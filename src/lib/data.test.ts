import { describe, expect, it } from "vitest";
import { AGENTS } from "./data";

describe("AGENTS", () => {
  it("keeps the canonical dashboard catalog limited to the original six plus diagnostic and research specialists", () => {
    expect(AGENTS).toHaveLength(8);
    expect(AGENTS.map(agent => agent.id)).toEqual([
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

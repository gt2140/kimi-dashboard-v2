import { describe, expect, it } from "vitest";
import { buildEnabledFormulaTools } from "./kimi-context-loader.js";

describe("buildEnabledFormulaTools", () => {
  it("keeps the classic runtime lightweight by default when no explicit tools are enabled", () => {
    expect(
      buildEnabledFormulaTools({
        allowWebResearch: false,
        allowScientificResearch: false,
        preferKimiMemory: false,
        enabledFormulaTools: [],
      }),
    ).toEqual([]);
  });

  it("preserves explicitly enabled tools", () => {
    expect(
      buildEnabledFormulaTools({
        allowWebResearch: false,
        allowScientificResearch: false,
        preferKimiMemory: false,
        enabledFormulaTools: ["moonshot/web-search:latest"],
      }),
    ).toEqual(["moonshot/web-search:latest"]);
  });
});

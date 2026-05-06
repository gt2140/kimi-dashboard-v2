import { describe, expect, it } from "vitest";
import {
  buildEnabledFormulaTools,
  resolveDefaultKimiThinkingMode,
} from "./kimi-context-loader.js";

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

  it("defaults personal-health turns to disabled thinking for faster chat", () => {
    expect(
      resolveDefaultKimiThinkingMode({
        agentSlug: "generalist",
        medicalMode: "personal-health",
        explicitThinkingMode: null,
      }),
    ).toBe("disabled");
  });

  it("keeps research turns on thinking by default", () => {
    expect(
      resolveDefaultKimiThinkingMode({
        agentSlug: "research-synthesizer",
        medicalMode: "research",
        explicitThinkingMode: null,
      }),
    ).toBe("enabled");
  });
});

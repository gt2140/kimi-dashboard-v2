import { describe, expect, it } from "vitest";
import {
  buildKimiPromptCacheKey,
  buildLongTermMemorySnippet,
  buildShortTermMemoryWindow,
} from "./kimi-memory.js";

describe("buildKimiPromptCacheKey", () => {
  it("generates a stable cache key from the conversation id", () => {
    expect(buildKimiPromptCacheKey(42)).toBe("kimi:v1:conversation:42");
  });
});

describe("buildShortTermMemoryWindow", () => {
  it("keeps the most recent turns and summarizes older context", () => {
    const memory = buildShortTermMemoryWindow({
      summary: "Earlier, the user shared a lipid panel trend.",
      messages: [
        { role: "user", content: "Old question 1" },
        { role: "assistant", content: "Old answer 1" },
        { role: "user", content: "Old question 2" },
        { role: "assistant", content: "Old answer 2" },
        { role: "user", content: "Recent question" },
        { role: "assistant", content: "Recent answer" },
      ],
      maxRecentMessages: 2,
    });

    expect(memory.summaryBlock).toContain("Earlier, the user shared a lipid panel trend.");
    expect(memory.recentMessages).toEqual([
      { role: "user", content: "Recent question" },
      { role: "assistant", content: "Recent answer" },
    ]);
  });
});

describe("buildLongTermMemorySnippet", () => {
  it("formats stable user memory into a compact prompt block", () => {
    const snippet = buildLongTermMemorySnippet([
      { key: "goal", value: "Improve LDL and ApoB", confidence: 0.95 },
      { key: "style", value: "Prefers concise answers", confidence: 0.88 },
    ]);

    expect(snippet).toContain("goal: Improve LDL and ApoB");
    expect(snippet).toContain("style: Prefers concise answers");
  });
});

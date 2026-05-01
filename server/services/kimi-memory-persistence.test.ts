import { describe, expect, it } from "vitest";
import {
  buildMemoryExtractionPrompt,
  parseMemoryUpdate,
} from "./kimi-memory-persistence.js";

describe("kimi-memory-persistence", () => {
  it("builds a prompt that includes existing summary and recent turns", () => {
    const prompt = buildMemoryExtractionPrompt({
      existingSummary: "The user is tracking lipid markers over time.",
      recentMessages: [
        { role: "user", content: "My main goal is better ApoB control." },
        { role: "assistant", content: "We'll use that as a durable goal." },
      ],
    });

    expect(prompt).toContain("Existing conversation summary");
    expect(prompt).toContain("ApoB");
    expect(prompt).toContain("stable user memories");
  });

  it("parses and normalizes memory keys from JSON output", () => {
    const parsed = parseMemoryUpdate(
      JSON.stringify({
        conversationSummary: "The user wants tighter lipid control.",
        userMemories: [
          {
            key: "Primary Goal",
            value: "Improve ApoB and long-term cardiovascular risk.",
            confidence: 0.91,
          },
        ],
      }),
    );

    expect(parsed?.conversationSummary).toContain("lipid control");
    expect(parsed?.userMemories[0]?.key).toBe("primary_goal");
    expect(parsed?.userMemories[0]?.confidence).toBe(0.91);
  });
});

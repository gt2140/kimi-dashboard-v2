import { describe, expect, it } from "vitest";
import {
  advanceRevealContent,
  buildPendingTurnStages,
  splitMessageForReveal,
} from "./chat-experience";

describe("chat-experience", () => {
  it("predicts a specialist consultation stage for relevant generalist messages", () => {
    const stages = buildPendingTurnStages({
      primaryAgentId: "generalist",
      helperAgentIds: [],
      userMessage: "Can you interpret my ApoB, LDL, and ferritin bloodwork?",
    });

    expect(stages.map(stage => stage.label)).toContain("Consulting Bloodwork");
    expect(stages[0]?.label).toBe("Mapping the full picture");
    expect(stages.at(-1)?.label).toBe("Drafting the answer");
  });

  it("uses explicit helpers before heuristic consultations", () => {
    const stages = buildPendingTurnStages({
      primaryAgentId: "generalist",
      helperAgentIds: ["nutrition", "supplements"],
      userMessage: "Review my current plan.",
    });

    expect(stages.map(stage => stage.label)).toContain("Consulting Nutrition");
    expect(stages.map(stage => stage.label)).toContain("Consulting Supplements");
    expect(stages.map(stage => stage.label)).not.toContain(
      "Consulting Bloodwork"
    );
  });

  it("splits long responses into reveal chunks without losing content", () => {
    const content = [
      "Direct answer: Your lipid panel looks broadly solid, but ApoB is the marker I would watch most closely here.",
      "",
      "What stands out: LDL alone can miss the real particle burden, so ApoB gives the cleaner signal when you are trying to estimate risk.",
      "",
      "Best next step: Repeat ApoB together with non-HDL cholesterol and hs-CRP in 8 to 12 weeks after any diet or supplement change.",
    ].join("\n");

    const chunks = splitMessageForReveal(content);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.join("")).toBe(content);
    expect(chunks.some(chunk => chunk.includes("What stands out"))).toBe(true);
  });

  it("reveals streamed content in natural reading steps", () => {
    const target =
      "Direct answer: ApoB matters most here. Next best step: repeat the panel in 8 weeks.";

    const first = advanceRevealContent("", target);
    const second = advanceRevealContent(first, target);

    expect(first.length).toBeGreaterThan(0);
    expect(first.length).toBeLessThan(target.length);
    expect(second.length).toBeGreaterThan(first.length);
    expect(advanceRevealContent(target, target)).toBe(target);
  });
});

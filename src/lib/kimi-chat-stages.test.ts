import { describe, expect, it } from "vitest";
import {
  applyRuntimeStageUpdate,
  createInitialPendingStages,
  resolveActiveStageIndex,
  STARTING_TURN_STAGE,
} from "./kimi-chat-stages";

describe("kimi-chat-stages", () => {
  it("starts with a single local placeholder stage", () => {
    expect(createInitialPendingStages()).toEqual([STARTING_TURN_STAGE]);
  });

  it("replaces the local placeholder when the first runtime stage arrives", () => {
    const stages = applyRuntimeStageUpdate(createInitialPendingStages(), {
      id: "memory",
      label: "Loading Aura context",
    });

    expect(stages).toEqual([
      {
        id: "memory",
        label: "Loading Aura context",
      },
    ]);
  });

  it("updates an existing runtime stage instead of duplicating it", () => {
    const stages = applyRuntimeStageUpdate(
      [
        { id: "memory", label: "Loading Aura context" },
        { id: "draft", label: "Drafting reply" },
      ],
      { id: "draft", label: "Writing the final answer" }
    );

    expect(stages).toEqual([
      { id: "memory", label: "Loading Aura context" },
      { id: "draft", label: "Writing the final answer" },
    ]);
    expect(resolveActiveStageIndex(stages)).toBe(1);
  });
});

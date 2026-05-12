import { describe, expect, it } from "vitest";
import { shouldUseProductionFastPath } from "./kimi-context-loader.js";

describe("shouldUseProductionFastPath", () => {
  it("enables the fast path for aura personal-health turns", () => {
    expect(
      shouldUseProductionFastPath({
        runtimeVersion: "aura-medical-v1",
        medicalMode: "personal-health",
      }),
    ).toBe(true);
  });

  it("keeps the richer path for research turns", () => {
    expect(
      shouldUseProductionFastPath({
        runtimeVersion: "aura-medical-v1",
        medicalMode: "research",
      }),
    ).toBe(false);
  });

  it("does not enable the production fast path for classic runtime turns", () => {
    expect(
      shouldUseProductionFastPath({
        runtimeVersion: "classic",
        medicalMode: "personal-health",
      }),
    ).toBe(false);
  });
});

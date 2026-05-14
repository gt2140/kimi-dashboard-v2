import { describe, expect, it } from "vitest";
import {
  resolveAuraRuntimeEndpoint,
  resolveAuraRuntimeOptions,
} from "./aura-runtime";

describe("aura runtime client helpers", () => {
  it("routes classic chat through the canonical chat stream endpoint", () => {
    expect(
      resolveAuraRuntimeEndpoint({
        runtimeVersion: "classic",
      }),
    ).toBe("/api/chat/stream");
  });

  it("routes aura medical transport settings to the canonical chat stream endpoint", () => {
    expect(
      resolveAuraRuntimeEndpoint({
        runtimeVersion: "aura-medical-v1",
      }),
    ).toBe("/api/chat/stream");
  });

  it("normalizes missing runtime settings to the classic defaults", () => {
    expect(resolveAuraRuntimeOptions({})).toEqual({
      runtimeVersion: "aura-medical-v1",
      medicalMode: "personal-health",
      policyLevel: "interpretive-on-request",
    });
  });
});

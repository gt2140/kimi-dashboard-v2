import { describe, expect, it } from "vitest";
import {
  resolveAuraRuntimeEndpoint,
  resolveAuraRuntimeOptions,
} from "./aura-runtime";

describe("aura runtime client helpers", () => {
  it("routes classic chat through the unified aura medical runtime endpoint", () => {
    expect(
      resolveAuraRuntimeEndpoint({
        runtimeVersion: "classic",
      }),
    ).toBe("/api/aura-medical/chat/stream");
  });

  it("routes aura medical chat to the medical stream endpoint", () => {
    expect(
      resolveAuraRuntimeEndpoint({
        runtimeVersion: "aura-medical-v1",
      }),
    ).toBe("/api/aura-medical/chat/stream");
  });

  it("normalizes missing runtime settings to the classic defaults", () => {
    expect(resolveAuraRuntimeOptions({})).toEqual({
      runtimeVersion: "aura-medical-v1",
      medicalMode: "personal-health",
      policyLevel: "interpretive-on-request",
    });
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("./kimi-context-loader.js", () => ({
  loadKimiTurnContext: vi.fn().mockResolvedValue({
    systemPrompt: "Base prompt",
    enabledFormulaTools: ["moonshot/web-search:latest"],
    promptCacheKey: "kimi:v1:conversation:9",
    runtimeMetadata: {},
  }),
}));

import { loadAuraMedicalTurnContext } from "./aura-medical-context-loader.js";

describe("loadAuraMedicalTurnContext", () => {
  it("respects flat runtime params from the turn service", async () => {
    const context = await loadAuraMedicalTurnContext({
      userId: 1,
      conversationId: 9,
      agentSlug: "generalist",
      latestUserMessage: "Busca evidencia reciente.",
      runtimeVersion: "aura-medical-v1",
      medicalMode: "research",
      policyLevel: "interpretive-on-request",
    });

    expect(context.promptCacheKey).toBe("aura-medical:v1:research:conversation:9");
    expect(context.systemPrompt).toContain("research mode");
    expect(context.enabledFormulaTools).toContain("moonshot/web-search:latest");
    expect(context.enabledFormulaTools).toContain("moonshot/rethink:latest");
  });
});

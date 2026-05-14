import { describe, expect, it, vi } from "vitest";
import {
  chatSendMessageInputSchema,
  generatePrimaryReply,
} from "./chat-router.js";

describe("generatePrimaryReply", () => {
  it("uses streaming generation when the chat turn is configured to stream", async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: "full reply",
      providerSlug: "venice",
      modelName: "zai-org-glm-5-1",
    });
    const streamText = vi.fn().mockImplementation(async input => {
      await input.onTextDelta?.("hola");
      await input.onTextDelta?.(" mundo");

      return {
        text: "hola mundo",
        providerSlug: "venice",
        modelName: "zai-org-glm-5-1",
        outputTokens: 3,
      };
    });
    const onTextDelta = vi.fn();

    const result = await generatePrimaryReply({
      gateway: {
        generateText,
        streamText,
      },
      providerSlug: "venice",
      modelName: "zai-org-glm-5-1",
      systemPrompt: "system",
      messages: [{ role: "user", content: "hola" }],
      streamPrimary: true,
      onTextDelta,
    });

    expect(streamText).toHaveBeenCalledOnce();
    expect(generateText).not.toHaveBeenCalled();
    expect(onTextDelta).toHaveBeenNthCalledWith(1, "hola");
    expect(onTextDelta).toHaveBeenNthCalledWith(2, " mundo");
    expect(result.text).toBe("hola mundo");
  });

  it("keeps chat input focused on an explicit Venice model selection", () => {
    const parsed = chatSendMessageInputSchema.parse({
      conversationId: 42,
      content: "Use GLM 5.1 for this question",
      agentId: "generalist",
      requestedModelName: "zai-org-glm-5-1",
    });

    expect(parsed).toEqual({
      conversationId: 42,
      content: "Use GLM 5.1 for this question",
      agentId: "generalist",
      requestedModelName: "zai-org-glm-5-1",
    });
    expect(parsed.requestedModelName).toBe("zai-org-glm-5-1");
  });

  it("accepts legacy transport fields while the backend runtime ignores them", () => {
    const parsed = chatSendMessageInputSchema.parse({
      conversationId: 42,
      content: "Keep the backend MVP simple",
      agentId: "generalist",
      calledAgentIds: ["bloodwork"],
      runtimeVersion: "aura-medical-v1",
      medicalMode: "personal-health",
      policyLevel: "interpretive-on-request",
      requestedProviderSlug: "openai",
      requestedModelName: "zai-org-glm-5-1",
    });

    expect(parsed.calledAgentIds).toEqual(["bloodwork"]);
    expect(parsed.runtimeVersion).toBe("aura-medical-v1");
    expect(parsed.medicalMode).toBe("personal-health");
    expect(parsed.policyLevel).toBe("interpretive-on-request");
    expect(parsed.requestedProviderSlug).toBe("openai");
    expect(parsed.requestedModelName).toBe("zai-org-glm-5-1");
  });
});

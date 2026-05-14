import { describe, expect, it, vi } from "vitest";
import { ModelGatewayAiProviderGateway } from "./ai-provider-gateway.js";

describe("ModelGatewayAiProviderGateway", () => {
  it("delegates explicit Venice model selections to the model gateway", async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: "hello from Venice",
      providerSlug: "venice",
      modelName: "zai-org-glm-5-1",
      inputTokens: 4,
      outputTokens: 8,
    });
    const streamText = vi.fn();
    const gateway = new ModelGatewayAiProviderGateway({
      modelGateway: {
        generateText,
        streamText,
      },
    });

    const result = await gateway.generateText({
      modelSelection: {
        providerSlug: "venice",
        modelName: "zai-org-glm-5-1",
      },
      systemPrompt: "system",
      messages: [{ role: "user", content: "hello" }],
    });

    expect(generateText).toHaveBeenCalledWith({
      providerSlug: "venice",
      modelName: "zai-org-glm-5-1",
      systemPrompt: "system",
      messages: [{ role: "user", content: "hello" }],
      signal: undefined,
    });
    expect(streamText).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      text: "hello from Venice",
      providerSlug: "venice",
      modelName: "zai-org-glm-5-1",
      inputTokens: 4,
      outputTokens: 8,
    });
  });

  it("streams through the model gateway while preserving deltas", async () => {
    const onTextDelta = vi.fn();
    const signal = new AbortController().signal;
    const streamText = vi.fn().mockImplementation(async input => {
      await input.onTextDelta?.("a");
      await input.onTextDelta?.("b");

      return {
        text: "ab",
        providerSlug: "venice",
        modelName: "venice-uncensored",
      };
    });
    const gateway = new ModelGatewayAiProviderGateway({
      modelGateway: {
        generateText: vi.fn(),
        streamText,
      },
    });

    const result = await gateway.streamText({
      modelSelection: {
        providerSlug: "venice",
        modelName: "venice-uncensored",
      },
      signal,
      messages: [{ role: "user", content: "stream" }],
      onTextDelta,
    });

    expect(streamText).toHaveBeenCalledOnce();
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        signal,
      }),
    );
    expect(onTextDelta).toHaveBeenNthCalledWith(1, "a");
    expect(onTextDelta).toHaveBeenNthCalledWith(2, "b");
    expect(result.text).toBe("ab");
  });

  it("rejects automatic selection until the runtime resolves a concrete provider", async () => {
    const gateway = new ModelGatewayAiProviderGateway({
      modelGateway: {
        generateText: vi.fn(),
        streamText: vi.fn(),
      },
    });

    await expect(
      gateway.generateText({
        modelSelection: {
          providerSlug: "auto",
          modelName: null,
        },
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow("A concrete provider is required");
  });
});

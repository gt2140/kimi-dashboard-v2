import { describe, expect, it, vi } from "vitest";
import { generatePrimaryReply } from "./chat-router.js";

describe("generatePrimaryReply", () => {
  it("uses streaming generation when the chat turn is configured to stream", async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: "full reply",
      providerSlug: "openai",
      modelName: "gpt-test",
    });
    const streamText = vi.fn().mockImplementation(async input => {
      await input.onTextDelta?.("hola");
      await input.onTextDelta?.(" mundo");

      return {
        text: "hola mundo",
        providerSlug: "openai",
        modelName: "gpt-test",
        outputTokens: 3,
      };
    });
    const onTextDelta = vi.fn();

    const result = await generatePrimaryReply({
      gateway: {
        generateText,
        streamText,
      },
      providerSlug: "openai",
      modelName: "gpt-test",
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
});

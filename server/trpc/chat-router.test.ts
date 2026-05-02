import { describe, expect, it } from "vitest";
import { chatSendMessageInputSchema } from "./chat-router.js";

describe("chatSendMessageInputSchema", () => {
  it("accepts the minimal direct-to-Kimi payload", () => {
    const parsed = chatSendMessageInputSchema.safeParse({
      conversationId: 12,
      content: "hola kimi",
      agentId: "generalist",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects an empty message", () => {
    const parsed = chatSendMessageInputSchema.safeParse({
      conversationId: 12,
      content: "",
      agentId: "generalist",
    });

    expect(parsed.success).toBe(false);
  });
});

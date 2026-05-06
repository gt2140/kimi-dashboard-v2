import { describe, expect, it } from "vitest";
import { buildKimiChatTimeline } from "./kimi-chat-timeline";
import type { Message } from "@/types";

describe("kimi-chat-timeline", () => {
  it("keeps the pending user turn before the streaming assistant reply", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content: "Contexto previo",
        agentId: "generalist",
        timestamp: new Date("2026-05-06T03:00:00.000Z"),
      },
    ];

    const timeline = buildKimiChatTimeline({
      messages,
      activeAgentId: "generalist",
      pendingUserMessage: "que me recomendarias como tratamiento optimo",
      streamingAssistant: {
        content: "Direct answer: primero necesito tus valores.",
      },
    });

    expect(timeline.map(message => message.id)).toEqual([
      "1",
      "pending-user",
      "kimi-streaming",
    ]);
  });

  it("does not add a streaming bubble when the assistant has not emitted text yet", () => {
    const timeline = buildKimiChatTimeline({
      messages: [],
      activeAgentId: "generalist",
      pendingUserMessage: "revisa este laboratorio",
      streamingAssistant: {
        content: "   ",
      },
    });

    expect(timeline.map(message => message.id)).toEqual(["pending-user"]);
  });
});


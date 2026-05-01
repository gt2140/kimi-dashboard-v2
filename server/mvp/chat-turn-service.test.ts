import { describe, expect, it, vi } from "vitest";
import { MvpChatTurnService } from "./chat-turn-service.js";

describe("MvpChatTurnService", () => {
  it("saves the user message, requests Kimi once, and persists the assistant reply", async () => {
    const store = {
      requireConversation: vi.fn().mockResolvedValue({
        id: 14,
        title: "New conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 101 }),
      listRecentMessages: vi.fn().mockResolvedValue([
        {
          role: "user",
          content: "Primer mensaje",
        },
        {
          role: "assistant",
          content: "Primera respuesta",
        },
        {
          role: "user",
          content: "Hola",
        },
      ]),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 202,
        createdAt: new Date("2026-05-01T18:00:00.000Z"),
      }),
      finalizeConversation: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      respond: vi.fn().mockResolvedValue({
        content: "Respuesta simple de Kimi.",
        model: "kimi-k2.6",
        finishReason: "stop",
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
        },
      }),
    };

    const service = new MvpChatTurnService(
      store as never,
      kimiClient as never,
    );

    const result = await service.execute({
      conversationId: 14,
      content: "Hola",
      agentId: "generalist",
      userId: 3,
    });

    expect(store.createUserMessage).toHaveBeenCalledWith({
      conversationId: 14,
      agentId: "generalist",
      content: "Hola",
    });
    expect(kimiClient.respond).toHaveBeenCalledWith(
      {
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.any(String),
          }),
          {
            role: "user",
            content: "Primer mensaje",
          },
          {
            role: "assistant",
            content: "Primera respuesta",
          },
          {
            role: "user",
            content: "Hola",
          },
        ],
        userId: 3,
      },
    );
    expect(result.content).toBe("Respuesta simple de Kimi.");
    expect(store.createAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 14,
        agentId: "generalist",
        content: "Respuesta simple de Kimi.",
      }),
    );
  });
});

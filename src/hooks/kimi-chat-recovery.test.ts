import { describe, expect, it, vi } from "vitest";
import { createPersistedCompletionReader } from "./kimi-chat-recovery";

describe("createPersistedCompletionReader", () => {
  it("returns the persisted assistant message after the matching user turn", async () => {
    const invalidateConversation = vi.fn().mockResolvedValue(undefined);
    const fetchConversation = vi.fn().mockResolvedValue({
      messages: [
        {
          id: 1,
          role: "user",
          content: "older question",
          agentId: "generalist",
          createdAt: "2026-05-07T11:59:00.000Z",
        },
        {
          id: 2,
          role: "assistant",
          content: "older answer",
          agentId: "generalist",
          createdAt: "2026-05-07T11:59:05.000Z",
        },
        {
          id: 3,
          role: "user",
          content: "Use my vault context.",
          agentId: "generalist",
          createdAt: "2026-05-07T12:00:00.000Z",
        },
        {
          id: 4,
          role: "assistant",
          content: "Recovered vault-backed answer.",
          agentId: "generalist",
          createdAt: "2026-05-07T12:00:06.000Z",
          metadata: {
            relatedVaultFiles: ["apob-panel.pdf"],
          },
        },
      ],
    });
    const onRecoveredMessage = vi.fn();

    const readPersistedCompletion = createPersistedCompletionReader({
      conversationId: 7,
      userMessage: "Use my vault context.",
      activeAgentId: "generalist",
      pollAttempts: 1,
      pollDelayMs: 0,
      invalidateConversation,
      fetchConversation,
      onRecoveredMessage,
    });

    const result = await readPersistedCompletion();

    expect(invalidateConversation).toHaveBeenCalledWith({ id: 7 });
    expect(fetchConversation).toHaveBeenCalledWith({ id: 7 });
    expect(result).toEqual({
      id: "4",
      role: "assistant",
      content: "Recovered vault-backed answer.",
      agentId: "generalist",
      createdAt: "2026-05-07T12:00:06.000Z",
      metadata: {
        relatedVaultFiles: ["apob-panel.pdf"],
      },
    });
    expect(onRecoveredMessage).toHaveBeenCalledWith(result);
  });

  it("returns null when no assistant message has been persisted for the matching user turn", async () => {
    const invalidateConversation = vi.fn().mockResolvedValue(undefined);
    const fetchConversation = vi.fn().mockResolvedValue({
      messages: [
        {
          id: 3,
          role: "user",
          content: "Use my vault context.",
          agentId: "generalist",
          createdAt: "2026-05-07T12:00:00.000Z",
        },
      ],
    });

    const readPersistedCompletion = createPersistedCompletionReader({
      conversationId: 7,
      userMessage: "Use my vault context.",
      activeAgentId: "generalist",
      pollAttempts: 1,
      pollDelayMs: 0,
      invalidateConversation,
      fetchConversation,
    });

    await expect(readPersistedCompletion()).resolves.toBeNull();
    expect(fetchConversation).toHaveBeenCalledTimes(1);
  });
});

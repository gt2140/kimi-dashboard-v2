import { beforeEach, describe, expect, it, vi } from "vitest";

describe("postKimiChatMessage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("posts the chat turn and returns the parsed backend payload", async () => {
    const buildAuthenticatedHeaders = vi.fn(async (_read, headers) => new Headers(headers));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: "Respuesta de Kimi",
          metadata: {
            modelName: "kimi-k2.6",
          },
        },
      }),
    });

    vi.doMock("@/lib/request-auth", () => ({
      buildAuthenticatedHeaders,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { postKimiChatMessage } = await import("./kimi-chat-api");

    const result = await postKimiChatMessage({
      readAccessToken: async () => "token-123",
      agentId: "generalist",
      content: "Hola",
      systemPrompt: "You are helpful.",
    });

    expect(buildAuthenticatedHeaders).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/kimi/chat",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect(result.message.content).toBe("Respuesta de Kimi");
  });

  it("fails fast with a readable timeout when the backend chat route hangs", async () => {
    vi.useFakeTimers();

    vi.doMock("@/lib/request-auth", () => ({
      buildAuthenticatedHeaders: vi.fn(async (_read, headers) => new Headers(headers)),
    }));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));

    const { postKimiChatMessage } = await import("./kimi-chat-api");

    const pending = postKimiChatMessage({
      readAccessToken: async () => "token-123",
      agentId: "generalist",
      content: "Hola",
      systemPrompt: "You are helpful.",
    });
    const assertion = expect(pending).rejects.toThrow(
      "Kimi chat request timed out after 35000ms.",
    );

    await vi.advanceTimersByTimeAsync(35_000);

    await assertion;
  });
});

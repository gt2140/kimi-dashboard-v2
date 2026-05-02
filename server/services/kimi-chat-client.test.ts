import { beforeEach, describe, expect, it, vi } from "vitest";

describe("requestKimiChatCompletion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("sends an OpenAI-compatible request to the Kimi chat completions endpoint", async () => {
    process.env.KIMI_API_KEY = "test-key";
    process.env.KIMI_OPEN_URL = "https://api.moonshot.ai";
    process.env.KIMI_MODEL = "kimi-k2.6";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: "kimi-k2.6",
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "Respuesta de prueba",
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { requestKimiChatCompletion } = await import("./kimi-chat-client.js");

    const result = await requestKimiChatCompletion({
      systemPrompt: "You are helpful.",
      message: "Hola",
      userId: 7,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.moonshot.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(result.content).toBe("Respuesta de prueba");
    expect(result.model).toBe("kimi-k2.6");
  });
});

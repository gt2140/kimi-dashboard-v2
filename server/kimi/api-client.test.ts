import { afterEach, describe, expect, it, vi } from "vitest";
import { KimiApiClient } from "./api-client.js";

describe("KimiApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns invalid authentication into a clear Kimi API key error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          error: {
            message: "Invalid Authentication",
            type: "invalid_authentication_error",
          },
        }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new KimiApiClient();

    await expect(
      client.createChatCompletion({
        model: "kimi-k2.6",
        messages: [{ role: "user", content: "Hello" }],
      }),
    ).rejects.toThrow(/KIMI_API_KEY is invalid/i);
  });

  it("reconstructs the final streamed assistant content from SSE deltas", async () => {
    const encoder = new TextEncoder();
    const sse = [
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Ho"}}]}',
      "",
      'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"la"}}]}',
      "",
      'data: {"id":"chatcmpl-1","choices":[{"finish_reason":"stop"}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sse));
          controller.close();
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new KimiApiClient();
    const onTextDelta = vi.fn();
    const result = await client.streamChatCompletion(
      {
        model: "kimi-k2.6",
        messages: [{ role: "user", content: "Hola" }],
      },
      { onTextDelta },
    );

    expect(onTextDelta).toHaveBeenNthCalledWith(1, "Ho");
    expect(onTextDelta).toHaveBeenNthCalledWith(2, "la");
    expect(result.choices?.[0]?.message?.content).toBe("Hola");
  });
});

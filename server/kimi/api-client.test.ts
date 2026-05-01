import { afterEach, describe, expect, it, vi } from "vitest";
import { KimiApiClient } from "./api-client.js";

const originalFetch = global.fetch;

describe("KimiApiClient", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("stops reading once the Kimi stream emits [DONE]", async () => {
    const encoder = new TextEncoder();
    const read = vi
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: encoder.encode(
          'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Hola"},"finish_reason":null}]}\n\n' +
            'data: {"id":"chatcmpl-1","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}\n\n' +
            "data: [DONE]\n\n",
        ),
      })
      .mockImplementationOnce(() => new Promise(() => null));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader() {
          return {
            read,
          };
        },
      },
    } as Response);

    const client = new KimiApiClient();

    const result = await Promise.race([
      client.streamChatCompletion(
        {
          model: "kimi-k2.6",
          messages: [{ role: "user", content: "Hola" }],
        },
        { onTextDelta: vi.fn() },
      ),
      new Promise(resolve => {
        setTimeout(() => resolve("timed-out"), 50);
      }),
    ]);

    expect(result).not.toBe("timed-out");
    expect(result).toMatchObject({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: "Hola",
          },
        },
      ],
    });
  });
});

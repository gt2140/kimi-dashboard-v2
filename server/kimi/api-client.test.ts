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
});

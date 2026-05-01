import { describe, expect, it } from "vitest";
import {
  buildKimiChatRequest,
  extractKimiAssistantText,
  extractKimiUsage,
} from "./chat-client.js";

describe("buildKimiChatRequest", () => {
  it("builds a kimi-k2.6 request with cache key, safety identifier, and thinking mode", () => {
    const request = buildKimiChatRequest({
      model: "kimi-k2.6",
      systemPrompt: "You are Generalist.",
      messages: [{ role: "user", content: "Review my labs" }],
      promptCacheKey: "kimi:v1:conversation:42",
      safetyIdentifier: "user-hash-1",
      thinking: "disabled",
      temperature: 0.2,
      maxCompletionTokens: 2048,
    });

    expect(request.model).toBe("kimi-k2.6");
    expect(request.prompt_cache_key).toBe("kimi:v1:conversation:42");
    expect(request.safety_identifier).toBe("user-hash-1");
    expect(request.temperature).toBeUndefined();
    expect(request.n).toBe(1);
    expect(request.max_completion_tokens).toBe(2048);
    expect(request.messages).toEqual([
      { role: "system", content: "You are Generalist." },
      { role: "user", content: "Review my labs" },
    ]);
    expect(request.thinking).toEqual({ type: "disabled" });
  });

  it("forces fixed sampling defaults for kimi-k2.6", () => {
    const request = buildKimiChatRequest({
      model: "kimi-k2.6",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 0,
      n: 3,
    });

    expect(request.temperature).toBeUndefined();
    expect(request.n).toBe(1);
  });

  it("enables structured output when a json schema is provided", () => {
    const request = buildKimiChatRequest({
      model: "kimi-k2.6",
      messages: [{ role: "user", content: "Summarize this" }],
      jsonSchema: {
        name: "kimi_summary",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
          },
          required: ["summary"],
        },
      },
    });

    expect(request.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "kimi_summary",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
          },
          required: ["summary"],
        },
      },
    });
  });
});

describe("extractKimiAssistantText", () => {
  it("prefers assistant content when present", () => {
    const text = extractKimiAssistantText({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Final answer",
          },
        },
      ],
    });

    expect(text).toBe("Final answer");
  });
});

describe("extractKimiUsage", () => {
  it("returns normalized usage values including cached tokens", () => {
    const usage = extractKimiUsage({
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cached_tokens: 25,
      },
    });

    expect(usage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cachedTokens: 25,
    });
  });
});

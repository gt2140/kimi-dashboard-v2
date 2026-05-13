import { describe, expect, it } from "vitest";
import {
  clearProviderOperationalBlock,
  extractOpenAIResponseText,
  extractOpenAIStreamEvents,
  getProviderOperationalBlock,
  ModelGatewayService,
  rememberProviderOperationalBlock,
} from "./model-gateway.js";

describe("extractOpenAIResponseText", () => {
  it("derives text from output content blocks when output_text is absent", () => {
    const text = extractOpenAIResponseText({
      output: [
        {
          content: [
            { type: "output_text", text: "Hello!" },
            { type: "other", text: "ignore me" },
          ],
        },
      ],
    });

    expect(text).toBe("Hello!");
  });

  it("prefers top-level output_text when present", () => {
    const text = extractOpenAIResponseText({
      output_text: "Top level text",
      output: [
        {
          content: [{ type: "output_text", text: "Nested text" }],
        },
      ],
    });

    expect(text).toBe("Top level text");
  });

  it("exposes live-provider support checks for routing decisions", () => {
    const gateway = new ModelGatewayService();

    expect(gateway.supportsProvider("openai")).toBe(true);
    expect(gateway.supportsProvider("venice")).toBe(true);
    expect(gateway.supportsProvider("anthropic")).toBe(false);
    expect(gateway.getDefaultModel("openai")).toBeTruthy();
    expect(gateway.getDefaultModel("venice")).toBe("zai-org-glm-5-1");
  });

  it("extracts semantic streaming events from SSE payload chunks", () => {
    const firstPass = extractOpenAIStreamEvents(
      [
        'event: response.output_text.delta',
        'data: {"type":"response.output_text.delta","delta":"Hello"}',
        "",
        'event: response.output_text.delta',
        'data: {"type":"response.output_text.delta","delta":" world',
      ].join("\n")
    );

    expect(firstPass.events).toHaveLength(1);
    expect(firstPass.events[0]).toEqual({
      type: "response.output_text.delta",
      delta: "Hello",
    });

    const secondPass = extractOpenAIStreamEvents(
      `${firstPass.remainder}"}\n\n`
    );

    expect(secondPass.events).toHaveLength(1);
    expect(secondPass.events[0]).toEqual({
      type: "response.output_text.delta",
      delta: " world",
    });
    expect(secondPass.remainder).toBe("");
  });

  it("extracts semantic streaming events when SSE frames use CRLF separators", () => {
    const parsed = extractOpenAIStreamEvents(
      'event: response.output_text.delta\r\n' +
        'data: {"type":"response.output_text.delta","delta":"Hola"}\r\n\r\n' +
        'event: response.completed\r\n' +
        'data: {"type":"response.completed","response":{"output_text":"Hola mundo"}}\r\n\r\n'
    );

    expect(parsed.events).toEqual([
      {
        type: "response.output_text.delta",
        delta: "Hola",
      },
      {
        type: "response.completed",
        response: {
          output_text: "Hola mundo",
        },
      },
    ]);
    expect(parsed.remainder).toBe("");
  });

  it("remembers provider operational blocks until they expire", () => {
    clearProviderOperationalBlock("openai");
    rememberProviderOperationalBlock(
      "openai",
      "OpenAI no pudo responder porque la cuota del proveedor esta agotada.",
      1_000
    );

    expect(getProviderOperationalBlock("openai", 1_500)).toBe(
      "OpenAI no pudo responder porque la cuota del proveedor esta agotada."
    );
    expect(getProviderOperationalBlock("openai", 1_000 + 5 * 60_000 + 1)).toBe(
      null
    );
  });
});

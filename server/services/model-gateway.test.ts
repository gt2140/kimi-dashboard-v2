import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVeniceModelCatalogCache,
  clearProviderOperationalBlock,
  extractOpenAIResponseText,
  extractOpenAIStreamEvents,
  getProviderOperationalBlock,
  formatContextWindow,
  getCuratedVeniceTextModels,
  mapVeniceModelToCatalogOption,
  ModelGatewayService,
  rememberProviderOperationalBlock,
} from "./model-gateway.js";

describe("extractOpenAIResponseText", () => {
  beforeEach(() => {
    clearProviderOperationalBlock("openai");
    clearProviderOperationalBlock("venice");
    clearVeniceModelCatalogCache();
  });

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

  it("exposes Venice as the only executable provider for the MVP", () => {
    const gateway = new ModelGatewayService();

    expect(gateway.supportsProvider("openai")).toBe(false);
    expect(gateway.supportsProvider("venice")).toBe(true);
    expect(gateway.supportsProvider("anthropic")).toBe(false);
    expect(gateway.getDefaultModel("venice")).toBe("zai-org-glm-5-1");
  });

  it("extracts semantic streaming events from SSE payload chunks", () => {
    const firstPass = extractOpenAIStreamEvents(
      [
        "event: response.output_text.delta",
        'data: {"type":"response.output_text.delta","delta":"Hello"}',
        "",
        "event: response.output_text.delta",
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
      "event: response.output_text.delta\r\n" +
        'data: {"type":"response.output_text.delta","delta":"Hola"}\r\n\r\n' +
        "event: response.completed\r\n" +
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

  it("formats large context windows into compact picker labels", () => {
    expect(formatContextWindow(128000)).toBe("128K");
    expect(formatContextWindow(198000)).toBe("198K");
    expect(formatContextWindow(1000000)).toBe("1M");
    expect(formatContextWindow(undefined)).toBe("Unknown");
  });

  it("maps Venice text model metadata into chat picker options", () => {
    const option = mapVeniceModelToCatalogOption({
      id: "venice-uncensored-1-2",
      type: "text",
      model_spec: {
        name: "Venice Uncensored 1.2",
        availableContextTokens: 128000,
        privacy: "private",
        traits: ["most_uncensored"],
        capabilities: {
          optimizedForCode: false,
          supportsVision: true,
          supportsReasoning: false,
        },
      },
    });

    expect(option).toMatchObject({
      providerSlug: "venice",
      modelName: "venice-uncensored-1-2",
      displayName: "Venice Uncensored 1.2",
      contextWindow: "128K",
      supportsCode: false,
      supportsVision: true,
      supportsReasoning: false,
    });
    expect(option.badges).toContain("Private");
    expect(option.badges).toContain("Uncensored");
    expect(option.badges).toContain("Most Uncensored");
  });

  it("marks uncensored Venice models even when the trait list is missing", () => {
    const option = mapVeniceModelToCatalogOption({
      id: "olafangensan-glm-4.7-flash-heretic",
      type: "text",
      model_spec: {
        name: "GLM 4.7 Flash Heretic",
        privacy: "private",
        capabilities: {},
      },
    });

    expect(option.badges).toContain("Private");
    expect(option.badges).toContain("Uncensored");
  });

  it("caches the Venice text model catalog inside the TTL", async () => {
    let now = 10_000;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "zai-org-glm-5-1",
            type: "text",
            model_spec: {
              name: "GLM 5.1",
              availableContextTokens: 200000,
              privacy: "private",
              capabilities: {},
            },
          },
        ],
      }),
    });
    const gateway = new ModelGatewayService({
      fetch: fetchMock as unknown as typeof fetch,
      now: () => now,
      veniceApiKey: "test-venice-key",
    });

    await expect(gateway.listVeniceTextModels()).resolves.toHaveLength(1);
    await expect(gateway.listVeniceTextModels()).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    now += 10 * 60_000 + 1;
    await expect(gateway.listVeniceTextModels()).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a curated Venice catalog when the live catalog is unavailable", async () => {
    const gateway = new ModelGatewayService({
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "provider unavailable",
      }) as unknown as typeof fetch,
      veniceApiKey: "test-venice-key",
    });

    await expect(gateway.listVeniceTextModels()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerSlug: "venice",
          modelName: "zai-org-glm-5-1",
          isDefaultCandidate: true,
        }),
      ])
    );
  });

  it("returns a curated Venice catalog when no Venice key is configured", async () => {
    const fetchMock = vi.fn();
    const gateway = new ModelGatewayService({
      fetch: fetchMock as unknown as typeof fetch,
      veniceApiKey: "",
    });

    await expect(gateway.listVeniceTextModels()).resolves.toEqual(
      getCuratedVeniceTextModels()
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-Venice chat execution", async () => {
    const gateway = new ModelGatewayService();

    await expect(
      gateway.generateText({
        providerSlug: "openai",
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow(
      "Venice is the only executable chat provider in this MVP stage."
    );
  });

  it("sanitizes Venice rate-limit failures and opens an operational block", async () => {
    const gateway = new ModelGatewayService({
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () =>
          '{"error":"daily limit exceeded","details":"raw upstream balance data"}',
      }) as unknown as typeof fetch,
      veniceApiKey: "test-venice-key",
    });

    await expect(
      gateway.generateText({
        providerSlug: "venice",
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow(
      "Venice request failed (429). The provider is rate-limiting or has reached its current capacity."
    );

    expect(getProviderOperationalBlock("venice")).toBe(
      "Venice no pudo responder porque el proveedor alcanzo su limite o capacidad actual."
    );
  });

  it("sanitizes Venice upstream streaming failures and opens an operational block", async () => {
    const gateway = new ModelGatewayService({
      fetch: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "origin timeout with internal provider trace",
      }) as unknown as typeof fetch,
      veniceApiKey: "test-venice-key",
    });

    await expect(
      gateway.streamText({
        providerSlug: "venice",
        messages: [{ role: "user", content: "hello" }],
      })
    ).rejects.toThrow(
      "Venice streaming request failed (503). The provider is temporarily unavailable."
    );

    expect(getProviderOperationalBlock("venice")).toBe(
      "Venice no pudo responder porque el proveedor esta temporalmente inestable."
    );
  });
});

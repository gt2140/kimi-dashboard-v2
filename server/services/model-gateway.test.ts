import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearVeniceModelCatalogCache,
  clearProviderOperationalBlock,
  getProviderOperationalBlock,
  formatContextWindow,
  getCuratedVeniceTextModels,
  mapVeniceModelToCatalogOption,
  ModelGatewayService,
  rememberProviderOperationalBlock,
} from "./model-gateway.js";

describe("ModelGatewayService", () => {
  beforeEach(() => {
    clearProviderOperationalBlock("venice");
    clearVeniceModelCatalogCache();
  });

  it("exposes Venice as the only executable provider for the MVP", () => {
    const gateway = new ModelGatewayService();

    expect(gateway.supportsProvider("openai")).toBe(false);
    expect(gateway.supportsProvider("venice")).toBe(true);
    expect(gateway.supportsProvider("anthropic")).toBe(false);
    expect(gateway.getDefaultModel("venice")).toBe("zai-org-glm-5");
  });

  it("remembers provider operational blocks until they expire", () => {
    rememberProviderOperationalBlock(
      "venice",
      "Venice no pudo responder porque la cuota del proveedor esta agotada.",
      1_000
    );

    expect(getProviderOperationalBlock("venice", 1_500)).toBe(
      "Venice no pudo responder porque la cuota del proveedor esta agotada."
    );
    expect(getProviderOperationalBlock("venice", 1_000 + 5 * 60_000 + 1)).toBe(
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
          modelName: "zai-org-glm-5",
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

  it("retries a model-not-found Venice response with a live catalog fallback", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => '{"error":"model not found"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "zai-org-glm-5",
              type: "text",
              model_spec: {
                name: "GLM 5",
                traits: ["default"],
                capabilities: {},
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "fallback works" } }],
          usage: { prompt_tokens: 4, completion_tokens: 2 },
        }),
      });
    const gateway = new ModelGatewayService({
      fetch: fetchMock as unknown as typeof fetch,
      veniceApiKey: "test-venice-key",
    });

    await expect(
      gateway.generateText({
        providerSlug: "venice",
        modelName: "retired-model",
        messages: [{ role: "user", content: "hello" }],
      })
    ).resolves.toMatchObject({
      text: "fallback works",
      modelName: "zai-org-glm-5",
    });
    expect(getProviderOperationalBlock("venice")).toBeNull();
  });

  it("diagnoses Venice generation readiness without exposing upstream response bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"bad key","secret":"raw upstream data"}',
    });
    const gateway = new ModelGatewayService({
      fetch: fetchMock as unknown as typeof fetch,
      veniceApiKey: "test-venice-key",
    });

    const result = await gateway.diagnoseVenice();

    expect(result).toEqual({
      ok: false,
      providerSlug: "venice",
      modelName: "zai-org-glm-5",
      status: 401,
      category: "auth",
      message: "Venice request failed (401). Check VENICE_API_KEY or VENICE_INFERENCE_KEY.",
    });

    expect(JSON.stringify(result)).not.toContain("raw upstream data");
  });

  it("diagnoses the explicitly selected Venice model", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "OK" } }],
      }),
    });
    const gateway = new ModelGatewayService({
      fetch: fetchMock as unknown as typeof fetch,
      veniceApiKey: "test-venice-key",
    });

    await expect(
      gateway.diagnoseVenice({ modelName: "venice-uncensored-1-2" })
    ).resolves.toMatchObject({
      ok: true,
      modelName: "venice-uncensored-1-2",
      category: "ready",
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject({
      model: "venice-uncensored-1-2",
    });
  });
});

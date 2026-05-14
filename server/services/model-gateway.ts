import { env } from "../lib/env.js";

export const LIVE_PROVIDER_SLUGS = ["venice"] as const;
export type LiveProviderSlug = (typeof LIVE_PROVIDER_SLUGS)[number];
const VENICE_REQUEST_TIMEOUT_MS = 25_000;
const PROVIDER_OPERATIONAL_BLOCK_MS = 5 * 60_000;
const SAFE_VENICE_FALLBACK_MODEL = "zai-org-glm-5";
const providerOperationalBlocks = new Map<
  string,
  {
    message: string;
    until: number;
  }
>();

export type GenerateTextInput = {
  providerSlug: string;
  modelName?: string | null;
  systemPrompt?: string | null;
  signal?: AbortSignal | null;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
};

export type GenerateTextOutput = {
  text: string;
  providerSlug: string;
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type StreamTextInput = GenerateTextInput & {
  onTextDelta?: (delta: string) => void | Promise<void>;
};

type ModelGatewayServiceOptions = {
  fetch?: typeof fetch;
  now?: () => number;
  veniceApiKey?: string;
};

export type VeniceCatalogOption = {
  providerSlug: "venice";
  modelName: string;
  displayName: string;
  providerLabel: "Venice";
  modelId: string;
  contextWindow: string;
  badges: string[];
  supportsReasoning: boolean;
  supportsVision: boolean;
  supportsCode: boolean;
  isDefaultCandidate: boolean;
};

type VeniceModelListEntry = {
  id: string;
  type?: string;
  model_spec?: {
    name?: string;
    availableContextTokens?: number;
    privacy?: string;
    betaModel?: boolean;
    traits?: string[];
    capabilities?: {
      optimizedForCode?: boolean;
      supportsVision?: boolean;
      supportsReasoning?: boolean;
    };
  };
};

const VENICE_MODEL_CATALOG_CACHE_TTL_MS = 10 * 60_000;
const CURATED_VENICE_TEXT_MODELS: VeniceModelListEntry[] = [
  {
    id: SAFE_VENICE_FALLBACK_MODEL,
    type: "text",
    model_spec: {
      name: "GLM 5",
      availableContextTokens: 198000,
      privacy: "private",
      traits: ["default"],
      capabilities: {
        supportsReasoning: true,
      },
    },
  },
  {
    id: env.veniceModel,
    type: "text",
    model_spec: {
      name: "Auto Venice Default",
      availableContextTokens: 200000,
      privacy: "private",
      traits: ["default"],
      capabilities: {
        supportsReasoning: true,
      },
    },
  },
];

let veniceModelCatalogCache: {
  apiKey: string;
  expiresAt: number;
  models: VeniceCatalogOption[];
} | null = null;

export function clearVeniceModelCatalogCache() {
  veniceModelCatalogCache = null;
}

export function getCuratedVeniceTextModels() {
  const byModelId = new Map<string, VeniceCatalogOption>();
  for (const model of CURATED_VENICE_TEXT_MODELS) {
    byModelId.set(model.id, mapVeniceModelToCatalogOption(model));
  }

  return Array.from(byModelId.values()).sort((left, right) => {
    if (left.modelName === env.veniceModel) return -1;
    if (right.modelName === env.veniceModel) return 1;
    return left.displayName.localeCompare(right.displayName);
  });
}

type ChatCompletionsResponsePayload = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

type ChatCompletionsStreamingEvent = {
  error?: {
    message?: string;
  };
  choices?: Array<{
    delta?: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
};

function isVeniceCapacityMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("daily limit") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("capacity")
  );
}

export function rememberProviderOperationalBlock(
  providerSlug: string,
  message: string,
  now = Date.now()
) {
  providerOperationalBlocks.set(providerSlug, {
    message,
    until: now + PROVIDER_OPERATIONAL_BLOCK_MS,
  });
}

export function getProviderOperationalBlock(
  providerSlug: string,
  now = Date.now()
) {
  const block = providerOperationalBlocks.get(providerSlug);
  if (!block) {
    return null;
  }

  if (block.until <= now) {
    providerOperationalBlocks.delete(providerSlug);
    return null;
  }

  return block.message;
}

export function clearProviderOperationalBlock(providerSlug: string) {
  providerOperationalBlocks.delete(providerSlug);
}

function normalizeVeniceTimeoutError(
  error: unknown,
  mode: "request" | "stream"
) {
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new Error(
      `Venice ${mode} timed out after ${VENICE_REQUEST_TIMEOUT_MS}ms.`
    );
  }

  return error;
}

function buildVeniceOperationalBlockMessage(status: number, body: string) {
  if (status === 402 || status === 429 || isVeniceCapacityMessage(body)) {
    return "Venice no pudo responder porque el proveedor alcanzo su limite o capacidad actual.";
  }

  return "Venice no pudo responder porque el proveedor esta temporalmente inestable.";
}

function isVeniceModelSelectionFailure(status: number, body: string) {
  const normalized = body.toLowerCase();
  return (
    status === 400 ||
    status === 404 ||
    normalized.includes("model not found") ||
    normalized.includes("invalid model") ||
    normalized.includes("unknown model") ||
    normalized.includes("model is not available")
  );
}

function buildSanitizedVeniceErrorMessage(
  mode: "request" | "streaming request" | "model list request",
  status: number,
  body: string
) {
  if (mode === "model list request") {
    if (status === 402 || status === 429 || isVeniceCapacityMessage(body)) {
      return `Venice ${mode} failed (${status}). The provider is rate-limiting or has reached its current capacity.`;
    }

    return `Venice ${mode} failed (${status}). The provider is temporarily unavailable.`;
  }

  if (isVeniceModelSelectionFailure(status, body)) {
    return `Venice ${mode} failed (${status}). The selected model is unavailable.`;
  }

  if (status === 402 || status === 429 || isVeniceCapacityMessage(body)) {
    return `Venice ${mode} failed (${status}). The provider is rate-limiting or has reached its current capacity.`;
  }

  return `Venice ${mode} failed (${status}). The provider is temporarily unavailable.`;
}

function buildVeniceSignal(signal?: AbortSignal | null) {
  return buildTimedSignal(VENICE_REQUEST_TIMEOUT_MS, signal);
}

function buildTimedSignal(timeoutMs: number, signal?: AbortSignal | null) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!signal) {
    return timeoutSignal;
  }

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([timeoutSignal, signal]);
  }

  const controller = new AbortController();
  const abort = (reason?: unknown) => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };

  timeoutSignal.addEventListener("abort", () => abort(timeoutSignal.reason), {
    once: true,
  });
  signal.addEventListener("abort", () => abort(signal.reason), {
    once: true,
  });

  return controller.signal;
}

function buildChatCompletionMessages(input: GenerateTextInput) {
  const messages = [...input.messages];
  if (input.systemPrompt?.trim()) {
    messages.unshift({
      role: "system",
      content: input.systemPrompt.trim(),
    });
  }

  return messages;
}

function extractChatCompletionsResponseText(
  payload: ChatCompletionsResponsePayload
) {
  return (
    payload.choices
      ?.map(choice => choice.message?.content?.trim() ?? "")
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

function extractChatCompletionsStreamEvents(buffer: string) {
  const normalizedBuffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const eventBlocks = normalizedBuffer.split("\n\n");
  const remainder = eventBlocks.pop() ?? "";
  const events: ChatCompletionsStreamingEvent[] = [];

  for (const block of eventBlocks) {
    const dataLines = block
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice("data:".length).trim())
      .filter(Boolean);

    if (dataLines.length === 0) {
      continue;
    }

    const payload = dataLines.join("\n");
    if (payload === "[DONE]") {
      continue;
    }

    try {
      events.push(JSON.parse(payload) as ChatCompletionsStreamingEvent);
    } catch {
      // Ignore malformed fragments until the next complete frame arrives.
    }
  }

  return {
    events,
    remainder,
  };
}

export function formatContextWindow(tokens?: number) {
  if (!tokens || tokens <= 0) {
    return "Unknown";
  }

  if (tokens >= 1_000_000) {
    const millions = tokens / 1_000_000;
    return Number.isInteger(millions)
      ? `${millions}M`
      : `${millions.toFixed(1)}M`;
  }

  return `${Math.round(tokens / 1_000)}K`;
}

function formatPrivacyBadge(privacy?: string) {
  switch (privacy) {
    case "anonymized":
      return "Anonymized";
    case "private":
      return "Private";
    default:
      return null;
  }
}

function isUncensoredVeniceModel(model: VeniceModelListEntry) {
  const searchable = [
    model.id,
    model.model_spec?.name ?? "",
    ...(model.model_spec?.traits ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return searchable.includes("uncensored") || searchable.includes("heretic");
}

export function mapVeniceModelToCatalogOption(
  model: VeniceModelListEntry
): VeniceCatalogOption {
  const badges = [
    formatPrivacyBadge(model.model_spec?.privacy),
    isUncensoredVeniceModel(model) ? "Uncensored" : null,
    model.model_spec?.betaModel ? "Beta" : null,
    model.model_spec?.capabilities?.supportsReasoning ? "Reasoning" : null,
    model.model_spec?.capabilities?.supportsVision ? "Vision" : null,
    model.model_spec?.capabilities?.optimizedForCode ? "Code" : null,
    ...(model.model_spec?.traits ?? []).map(trait =>
      trait
        .split(/[_-]/g)
        .filter(Boolean)
        .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(" ")
    ),
  ].filter((badge): badge is string => Boolean(badge));

  return {
    providerSlug: "venice",
    modelName: model.id,
    displayName: model.model_spec?.name?.trim() || model.id,
    providerLabel: "Venice",
    modelId: model.id,
    contextWindow: formatContextWindow(
      model.model_spec?.availableContextTokens
    ),
    badges: Array.from(new Set(badges)),
    supportsReasoning: Boolean(
      model.model_spec?.capabilities?.supportsReasoning
    ),
    supportsVision: Boolean(model.model_spec?.capabilities?.supportsVision),
    supportsCode: Boolean(model.model_spec?.capabilities?.optimizedForCode),
    isDefaultCandidate:
      model.id === env.veniceModel ||
      (model.model_spec?.traits ?? []).includes("default"),
  };
}

export class ModelGatewayService {
  private readonly options: ModelGatewayServiceOptions;

  constructor(options: ModelGatewayServiceOptions = {}) {
    this.options = options;
  }

  private getFetchImplementation() {
    return this.options.fetch ?? fetch;
  }

  private getCurrentTime() {
    return this.options.now?.() ?? Date.now();
  }

  private getVeniceApiKey() {
    return this.options.veniceApiKey ?? env.veniceApiKey;
  }

  supportsProvider(providerSlug: string): providerSlug is LiveProviderSlug {
    return LIVE_PROVIDER_SLUGS.includes(providerSlug as LiveProviderSlug);
  }

  getDefaultModel(_providerSlug: LiveProviderSlug = "venice") {
    return env.veniceModel || SAFE_VENICE_FALLBACK_MODEL;
  }

  private async resolveVeniceFallbackModel(failedModel: string) {
    const liveModels = await this.listVeniceTextModels();
    const fallback =
      liveModels.find(model => model.isDefaultCandidate)?.modelName ||
      liveModels[0]?.modelName ||
      SAFE_VENICE_FALLBACK_MODEL;

    return fallback && fallback !== failedModel ? fallback : null;
  }

  async listVeniceTextModels(): Promise<VeniceCatalogOption[]> {
    const veniceApiKey = this.getVeniceApiKey();
    if (!veniceApiKey) {
      return getCuratedVeniceTextModels();
    }

    const now = this.getCurrentTime();
    if (
      veniceModelCatalogCache?.apiKey === veniceApiKey &&
      veniceModelCatalogCache.expiresAt > now
    ) {
      return veniceModelCatalogCache.models;
    }

    const fetchImpl = this.getFetchImplementation();
    let models: VeniceCatalogOption[];

    try {
      const response = await fetchImpl(
        "https://api.venice.ai/api/v1/models?type=text",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${veniceApiKey}`,
          },
          signal: buildVeniceSignal(),
        }
      );

      if (!response.ok) {
        await response.text();
        return getCuratedVeniceTextModels();
      }

      const payload = (await response.json()) as {
        data?: VeniceModelListEntry[];
      };

      models = (payload.data ?? [])
        .filter(model => model.type === "text" && typeof model.id === "string")
        .map(mapVeniceModelToCatalogOption)
        .sort((left, right) =>
          left.displayName.localeCompare(right.displayName)
        );
    } catch {
      return getCuratedVeniceTextModels();
    }

    if (models.length === 0) {
      return getCuratedVeniceTextModels();
    }

    veniceModelCatalogCache = {
      apiKey: veniceApiKey,
      expiresAt: now + VENICE_MODEL_CATALOG_CACHE_TTL_MS,
      models,
    };

    return models;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    if (input.providerSlug !== "venice") {
      throw new Error(
        "Venice is the only executable chat provider in this MVP stage."
      );
    }

    if (!this.getVeniceApiKey()) {
      throw new Error(
        "VENICE_API_KEY is missing. Add it to app/.env before using Venice generation."
      );
    }

    const providerBlock = getProviderOperationalBlock("venice");
    if (providerBlock) {
      throw new Error(providerBlock);
    }

    return this.generateWithVenice(input);
  }

  async streamText(input: StreamTextInput): Promise<GenerateTextOutput> {
    if (input.providerSlug !== "venice") {
      throw new Error(
        "Venice is the only executable chat provider in this MVP stage."
      );
    }

    if (!this.getVeniceApiKey()) {
      throw new Error(
        "VENICE_API_KEY is missing. Add it to app/.env before using Venice generation."
      );
    }

    const providerBlock = getProviderOperationalBlock("venice");
    if (providerBlock) {
      throw new Error(providerBlock);
    }

    return this.streamWithVenice(input);
  }

  private async generateWithVenice(
    input: GenerateTextInput,
    attemptedModelFallback = false
  ): Promise<GenerateTextOutput> {
    const model = input.modelName || this.getDefaultModel("venice");
    const veniceApiKey = this.getVeniceApiKey();
    const fetchImpl = this.getFetchImplementation();

    let response: Response;

    try {
      response = await fetchImpl(
        "https://api.venice.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${veniceApiKey}`,
            "Content-Type": "application/json",
          },
          signal: buildVeniceSignal(input.signal),
          body: JSON.stringify({
            model,
            messages: buildChatCompletionMessages(input),
          }),
        }
      );
    } catch (error) {
      throw normalizeVeniceTimeoutError(error, "request");
    }

    if (!response.ok) {
      const body = await response.text();
      if (
        isVeniceModelSelectionFailure(response.status, body) &&
        !attemptedModelFallback
      ) {
        const fallbackModel = await this.resolveVeniceFallbackModel(model);
        if (fallbackModel) {
          return this.generateWithVenice(
            {
              ...input,
              modelName: fallbackModel,
            },
            true
          );
        }
      }

      if (!isVeniceModelSelectionFailure(response.status, body)) {
        rememberProviderOperationalBlock(
          "venice",
          buildVeniceOperationalBlockMessage(response.status, body),
          this.getCurrentTime()
        );
      }
      throw new Error(
        buildSanitizedVeniceErrorMessage("request", response.status, body)
      );
    }

    const payload = (await response.json()) as ChatCompletionsResponsePayload;
    const text = extractChatCompletionsResponseText(payload);

    if (!text.trim()) {
      throw new Error("Venice returned an empty assistant message.");
    }

    clearProviderOperationalBlock("venice");

    return {
      text,
      providerSlug: "venice",
      modelName: model,
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
    };
  }

  private async streamWithVenice(
    input: StreamTextInput
  ): Promise<GenerateTextOutput> {
    const model = input.modelName || this.getDefaultModel("venice");
    const veniceApiKey = this.getVeniceApiKey();
    const fetchImpl = this.getFetchImplementation();

    let response: Response;

    try {
      response = await fetchImpl(
        "https://api.venice.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${veniceApiKey}`,
            "Content-Type": "application/json",
          },
          signal: buildVeniceSignal(input.signal),
          body: JSON.stringify({
            model,
            stream: true,
            messages: buildChatCompletionMessages(input),
          }),
        }
      );
    } catch (error) {
      throw normalizeVeniceTimeoutError(error, "stream");
    }

    if (!response.ok) {
      const body = await response.text();
      rememberProviderOperationalBlock(
        "venice",
        buildVeniceOperationalBlockMessage(response.status, body),
        this.getCurrentTime()
      );
      throw new Error(
        buildSanitizedVeniceErrorMessage(
          "streaming request",
          response.status,
          body
        )
      );
    }

    if (!response.body) {
      throw new Error(
        "Venice streaming response did not include a readable body."
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let aggregatedText = "";

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      const parsed = extractChatCompletionsStreamEvents(buffer);
      buffer = parsed.remainder;

      for (const event of parsed.events) {
        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          aggregatedText += delta;
          await input.onTextDelta?.(delta);
          continue;
        }

        if (event.error?.message) {
          if (isVeniceCapacityMessage(event.error.message)) {
            rememberProviderOperationalBlock(
              "venice",
              "Venice no pudo responder porque el proveedor alcanzo su limite o capacidad actual.",
              this.getCurrentTime()
            );
          }
          throw new Error(
            "Venice streaming response returned a provider error."
          );
        }
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      const parsed = extractChatCompletionsStreamEvents(`${buffer}\n\n`);
      for (const event of parsed.events) {
        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          aggregatedText += delta;
          await input.onTextDelta?.(delta);
          continue;
        }

        if (event.error?.message) {
          if (isVeniceCapacityMessage(event.error.message)) {
            rememberProviderOperationalBlock(
              "venice",
              "Venice no pudo responder porque el proveedor alcanzo su limite o capacidad actual.",
              this.getCurrentTime()
            );
          }
          throw new Error(
            "Venice streaming response returned a provider error."
          );
        }
      }
    }

    if (!aggregatedText.trim()) {
      throw new Error(
        "Venice streaming response completed without text output."
      );
    }

    clearProviderOperationalBlock("venice");

    return {
      text: aggregatedText,
      providerSlug: "venice",
      modelName: model,
    };
  }
}

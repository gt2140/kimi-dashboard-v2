import { env } from "../lib/env.js";

export const LIVE_PROVIDER_SLUGS = ["openai", "venice"] as const;
export type LiveProviderSlug = (typeof LIVE_PROVIDER_SLUGS)[number];
const OPENAI_REQUEST_TIMEOUT_MS = 25_000;
const VENICE_REQUEST_TIMEOUT_MS = 25_000;
const PROVIDER_OPERATIONAL_BLOCK_MS = 5 * 60_000;
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

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

type OpenAIStreamingEvent = {
  type?: string;
  delta?: string;
  error?: {
    message?: string;
  };
  response?: OpenAIResponsePayload & {
    id?: string;
  };
};

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

function isQuotaExceededMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("exceeded your current quota") ||
    normalized.includes("billing details")
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

export function extractOpenAIResponseText(payload: OpenAIResponsePayload) {
  if (payload.output_text?.trim()) {
    return payload.output_text.trim();
  }

  const derived = (payload.output ?? [])
    .flatMap(item => item.content ?? [])
    .filter(item => item.type === "output_text" && typeof item.text === "string")
    .map(item => item.text!.trim())
    .filter(Boolean)
    .join("\n");

  return derived;
}

export function extractOpenAIStreamEvents(buffer: string) {
  const normalizedBuffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const eventBlocks = normalizedBuffer.split("\n\n");
  const remainder = eventBlocks.pop() ?? "";
  const events: OpenAIStreamingEvent[] = [];

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
      events.push(JSON.parse(payload) as OpenAIStreamingEvent);
    } catch {
      // Keep the parser resilient to unknown/partial event frames.
    }
  }

  return {
    events,
    remainder,
  };
}

function normalizeOpenAITimeoutError(error: unknown, mode: "request" | "stream") {
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new Error(
      `OpenAI ${mode} timed out after ${OPENAI_REQUEST_TIMEOUT_MS}ms.`
    );
  }

  return error;
}

function normalizeVeniceTimeoutError(error: unknown, mode: "request" | "stream") {
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

function buildOpenAISignal(signal?: AbortSignal | null) {
  return buildTimedSignal(OPENAI_REQUEST_TIMEOUT_MS, signal);
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

function extractChatCompletionsResponseText(payload: ChatCompletionsResponsePayload) {
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

export class ModelGatewayService {
  supportsProvider(providerSlug: string): providerSlug is LiveProviderSlug {
    return LIVE_PROVIDER_SLUGS.includes(providerSlug as LiveProviderSlug);
  }

  getDefaultModel(providerSlug: LiveProviderSlug) {
    switch (providerSlug) {
      case "venice":
        return env.veniceModel;
      case "openai":
      default:
        return env.openaiModel;
    }
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    if (!this.supportsProvider(input.providerSlug)) {
      throw new Error(
        `Provider ${input.providerSlug} is not connected yet. Only live providers can answer chat turns.`
      );
    }

    if (input.providerSlug === "openai") {
      if (!env.openaiApiKey) {
        throw new Error(
          "OPENAI_API_KEY is missing. Add it to app/.env before using OpenAI generation."
        );
      }

      const providerBlock = getProviderOperationalBlock("openai");
      if (providerBlock) {
        throw new Error(providerBlock);
      }

      return this.generateWithOpenAI(input);
    }

    if (!env.veniceApiKey) {
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
    if (!this.supportsProvider(input.providerSlug)) {
      throw new Error(
        `Provider ${input.providerSlug} is not connected yet. Only live providers can answer chat turns.`
      );
    }

    if (input.providerSlug === "openai") {
      if (!env.openaiApiKey) {
        throw new Error(
          "OPENAI_API_KEY is missing. Add it to app/.env before using OpenAI generation."
        );
      }

      const providerBlock = getProviderOperationalBlock("openai");
      if (providerBlock) {
        throw new Error(providerBlock);
      }

      return this.streamWithOpenAI(input);
    }

    if (!env.veniceApiKey) {
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

  private async generateWithOpenAI(
    input: GenerateTextInput
  ): Promise<GenerateTextOutput> {
    const model = input.modelName || this.getDefaultModel("openai");

    let response: Response;

    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        signal: buildOpenAISignal(input.signal),
        body: JSON.stringify({
          model,
          instructions: input.systemPrompt || undefined,
          input: input.messages.map(message => ({
            role: message.role,
            content: [
              {
                type: "input_text",
                text: message.content,
              },
            ],
          })),
        }),
      });
    } catch (error) {
      throw normalizeOpenAITimeoutError(error, "request");
    }

    if (!response.ok) {
      const body = await response.text();
      if (isQuotaExceededMessage(body)) {
        rememberProviderOperationalBlock(
          "openai",
          "OpenAI no pudo responder porque la cuota del proveedor esta agotada."
        );
      }
      throw new Error(
        `OpenAI request failed (${response.status}): ${body.slice(0, 500)}`
      );
    }

    const payload = (await response.json()) as OpenAIResponsePayload;
    const text = extractOpenAIResponseText(payload);

    if (!text.trim()) {
      throw new Error("OpenAI returned an empty output_text payload.");
    }

    clearProviderOperationalBlock("openai");

    return {
      text,
      providerSlug: "openai",
      modelName: model,
      inputTokens: payload.usage?.input_tokens,
      outputTokens: payload.usage?.output_tokens,
    };
  }

  private async streamWithOpenAI(
    input: StreamTextInput
  ): Promise<GenerateTextOutput> {
    const model = input.modelName || this.getDefaultModel("openai");

    let response: Response;

    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        signal: buildOpenAISignal(input.signal),
        body: JSON.stringify({
          model,
          stream: true,
          instructions: input.systemPrompt || undefined,
          input: input.messages.map(message => ({
            role: message.role,
            content: [
              {
                type: "input_text",
                text: message.content,
              },
            ],
          })),
        }),
      });
    } catch (error) {
      throw normalizeOpenAITimeoutError(error, "stream");
    }

    if (!response.ok) {
      const body = await response.text();
      if (isQuotaExceededMessage(body)) {
        rememberProviderOperationalBlock(
          "openai",
          "OpenAI no pudo responder porque la cuota del proveedor esta agotada."
        );
      }
      throw new Error(
        `OpenAI streaming request failed (${response.status}): ${body.slice(0, 500)}`
      );
    }

    if (!response.body) {
      throw new Error("OpenAI streaming response did not include a readable body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let aggregatedText = "";
    let completedResponse: OpenAIResponsePayload | null = null;

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      const parsed = extractOpenAIStreamEvents(buffer);
      buffer = parsed.remainder;

      for (const event of parsed.events) {
        if (
          event.type === "response.output_text.delta" &&
          typeof event.delta === "string"
        ) {
          aggregatedText += event.delta;
          await input.onTextDelta?.(event.delta);
          continue;
        }

        if (event.type === "response.completed" && event.response) {
          completedResponse = event.response;
          if (!aggregatedText.trim()) {
            aggregatedText = extractOpenAIResponseText(event.response);
          }
          continue;
        }

        if (event.type === "error") {
          if (event.error?.message && isQuotaExceededMessage(event.error.message)) {
            rememberProviderOperationalBlock(
              "openai",
              "OpenAI no pudo responder porque la cuota del proveedor esta agotada."
            );
          }
          throw new Error(
            event.error?.message || "OpenAI streaming response returned an error event."
          );
        }
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      const parsed = extractOpenAIStreamEvents(`${buffer}\n\n`);

      for (const event of parsed.events) {
        if (
          event.type === "response.output_text.delta" &&
          typeof event.delta === "string"
        ) {
          aggregatedText += event.delta;
          await input.onTextDelta?.(event.delta);
          continue;
        }

        if (event.type === "response.completed" && event.response) {
          completedResponse = event.response;
          if (!aggregatedText.trim()) {
            aggregatedText = extractOpenAIResponseText(event.response);
          }
          continue;
        }

        if (event.type === "error") {
          if (event.error?.message && isQuotaExceededMessage(event.error.message)) {
            rememberProviderOperationalBlock(
              "openai",
              "OpenAI no pudo responder porque la cuota del proveedor esta agotada."
            );
          }
          throw new Error(
            event.error?.message || "OpenAI streaming response returned an error event."
          );
        }
      }
    }

    if (!aggregatedText.trim() && completedResponse) {
      aggregatedText = extractOpenAIResponseText(completedResponse);
    }

    if (!aggregatedText.trim()) {
      throw new Error("OpenAI streaming response completed without text output.");
    }

    clearProviderOperationalBlock("openai");

    return {
      text: aggregatedText,
      providerSlug: "openai",
      modelName: model,
      inputTokens: completedResponse?.usage?.input_tokens,
      outputTokens: completedResponse?.usage?.output_tokens,
    };
  }

  private async generateWithVenice(
    input: GenerateTextInput
  ): Promise<GenerateTextOutput> {
    const model = input.modelName || this.getDefaultModel("venice");

    let response: Response;

    try {
      response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.veniceApiKey}`,
          "Content-Type": "application/json",
        },
        signal: buildVeniceSignal(input.signal),
        body: JSON.stringify({
          model,
          messages: buildChatCompletionMessages(input),
        }),
      });
    } catch (error) {
      throw normalizeVeniceTimeoutError(error, "request");
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Venice request failed (${response.status}): ${body.slice(0, 500)}`
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

    let response: Response;

    try {
      response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.veniceApiKey}`,
          "Content-Type": "application/json",
        },
        signal: buildVeniceSignal(input.signal),
        body: JSON.stringify({
          model,
          stream: true,
          messages: buildChatCompletionMessages(input),
        }),
      });
    } catch (error) {
      throw normalizeVeniceTimeoutError(error, "stream");
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Venice streaming request failed (${response.status}): ${body.slice(0, 500)}`
      );
    }

    if (!response.body) {
      throw new Error("Venice streaming response did not include a readable body.");
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
          throw new Error(event.error.message);
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
          throw new Error(event.error.message);
        }
      }
    }

    if (!aggregatedText.trim()) {
      throw new Error("Venice streaming response completed without text output.");
    }

    clearProviderOperationalBlock("venice");

    return {
      text: aggregatedText,
      providerSlug: "venice",
      modelName: model,
    };
  }
}

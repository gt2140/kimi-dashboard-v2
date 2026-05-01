type KimiToolCall = {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
};

type KimiMessage =
  | {
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      name?: string;
      tool_call_id?: string;
      tool_calls?: KimiToolCall[];
      partial?: boolean;
    }
  | {
      role: "system" | "user" | "assistant";
      content: Array<Record<string, unknown>>;
      name?: string;
      partial?: boolean;
    };

type KimiThinkingMode = "enabled" | "disabled";

type KimiJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

type BuildKimiChatRequestInput = {
  model: string;
  systemPrompt?: string | null;
  messages: Array<{
    role: "user" | "assistant" | "tool";
    content: string;
    name?: string;
    toolCallId?: string;
    toolCalls?: KimiToolCall[];
  }>;
  promptCacheKey?: string | null;
  safetyIdentifier?: string | null;
  thinking?: KimiThinkingMode | null;
  temperature?: number | null;
  n?: number | null;
  maxCompletionTokens?: number | null;
  tools?: Array<Record<string, unknown>>;
  responseFormat?: "text" | "json_object";
  jsonSchema?: KimiJsonSchema | null;
};

type KimiChatRequest = {
  model: string;
  messages: KimiMessage[];
  prompt_cache_key?: string;
  safety_identifier?: string;
  thinking?: { type: KimiThinkingMode };
  temperature?: number;
  n?: number;
  max_completion_tokens?: number;
  tools?: Array<Record<string, unknown>>;
  response_format?:
    | { type: "text" | "json_object" }
    | {
        type: "json_schema";
        json_schema: KimiJsonSchema;
      };
};

type KimiCompletionPayload = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
  };
};

function normalizeTemperature(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, value));
}

export function buildKimiChatRequest(
  input: BuildKimiChatRequestInput,
): KimiChatRequest {
  const temperature = normalizeTemperature(input.temperature);
  const request: KimiChatRequest = {
    model: input.model,
    messages: [
      ...(input.systemPrompt
        ? [{ role: "system" as const, content: input.systemPrompt }]
        : []),
      ...input.messages.map(message => ({
        role: message.role,
        content: message.content,
        ...(message.name ? { name: message.name } : {}),
        ...(message.toolCallId
          ? { tool_call_id: message.toolCallId }
          : {}),
        ...(message.toolCalls?.length
          ? { tool_calls: message.toolCalls }
          : {}),
      })),
    ],
  };

  if (input.promptCacheKey) {
    request.prompt_cache_key = input.promptCacheKey;
  }

  if (input.safetyIdentifier) {
    request.safety_identifier = input.safetyIdentifier;
  }

  if (input.thinking) {
    request.thinking = { type: input.thinking };
  }

  if (temperature !== undefined) {
    request.temperature = temperature;
  }

  if (input.maxCompletionTokens) {
    request.max_completion_tokens = input.maxCompletionTokens;
  }

  if (input.tools?.length) {
    request.tools = input.tools;
  }

  if (input.jsonSchema) {
    request.response_format = {
      type: "json_schema",
      json_schema: input.jsonSchema,
    };
  } else if (input.responseFormat === "json_object") {
    request.response_format = { type: "json_object" };
  }

  if (temperature !== undefined && temperature <= 0.001) {
    request.n = 1;
  } else if (input.n && input.n > 0) {
    request.n = input.n;
  }

  return request;
}

export function extractKimiAssistantText(payload: KimiCompletionPayload) {
  return (
    payload.choices?.[0]?.message?.content?.trim() ??
    ""
  );
}

export function extractKimiUsage(payload: KimiCompletionPayload) {
  return {
    inputTokens: payload.usage?.prompt_tokens,
    outputTokens: payload.usage?.completion_tokens,
    totalTokens: payload.usage?.total_tokens,
    cachedTokens: payload.usage?.cached_tokens,
  };
}

export type {
  BuildKimiChatRequestInput,
  KimiChatRequest,
  KimiJsonSchema,
  KimiToolCall,
};

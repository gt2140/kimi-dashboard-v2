import { env } from "../lib/env.js";
import { withAbortableTimeout } from "./async-guard.js";

const KIMI_CHAT_TIMEOUT_MS = 30_000;

type KimiChatPayload = {
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function getBaseUrl() {
  const baseUrl = env.kimiOpenUrl.replace(/\/$/, "");
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function getApiKey() {
  if (!env.kimiApiKey) {
    throw new Error("KIMI_API_KEY is missing on the backend.");
  }

  return env.kimiApiKey;
}

export async function requestKimiChatCompletion(params: {
  systemPrompt: string;
  message: string;
  userId: number;
}) {
  const response = await withAbortableTimeout(
    signal =>
      fetch(`${getBaseUrl()}/chat/completions`, {
        signal,
        method: "POST",
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.kimiModel || "kimi-k2.6",
          messages: [
            {
              role: "system",
              content: params.systemPrompt,
            },
            {
              role: "user",
              content: params.message,
            },
          ],
          safety_identifier: `user-${params.userId}`,
          thinking: {
            type: "disabled",
          },
        }),
      }),
    {
      label: "Kimi chat completion",
      timeoutMs: KIMI_CHAT_TIMEOUT_MS,
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Kimi request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const payload = (await response.json()) as KimiChatPayload;
  const content = payload.choices?.[0]?.message?.content?.trim() ?? "";

  if (!content) {
    throw new Error("Kimi returned an empty assistant message.");
  }

  return {
    content,
    model: payload.model ?? env.kimiModel ?? "kimi-k2.6",
    finishReason: payload.choices?.[0]?.finish_reason ?? null,
    usage: {
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens,
    },
  };
}

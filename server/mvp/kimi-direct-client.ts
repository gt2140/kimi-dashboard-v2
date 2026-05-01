import { env } from "../lib/env.js";

type KimiReply = {
  content: string;
  model: string;
  finishReason: string | null;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedTokens?: number;
  };
};

type KimiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type KimiResponsePayload = {
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
    cached_tokens?: number;
  };
};

function getBaseUrl() {
  return env.kimiOpenUrl.replace(/\/$/, "");
}

function getApiKey() {
  if (!env.kimiApiKey) {
    throw new Error("KIMI_API_KEY is missing on the backend.");
  }

  return env.kimiApiKey;
}

export class KimiDirectClient {
  async respond(params: {
    messages: KimiChatMessage[];
    userId: number;
  }): Promise<KimiReply> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error("Kimi direct request timed out after 30000ms."));
    }, 30_000);

    try {
      const response = await fetch(`${getBaseUrl()}/v1/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.kimiModel || "kimi-k2.6",
          messages: params.messages,
          safety_identifier: `user-${params.userId}`,
          thinking: {
            type: "disabled",
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Kimi direct request failed (${response.status}): ${body.slice(0, 500)}`);
      }

      const payload = (await response.json()) as KimiResponsePayload;
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
          cachedTokens: payload.usage?.cached_tokens,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

import { env } from "../lib/env.js";
import { logServerDebug, logServerError } from "../lib/debug.js";
import { withAbortableTimeout } from "../services/async-guard.js";

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
    logServerDebug("kimi.direct.request.start", {
      userId: params.userId,
      messageCount: params.messages.length,
      model: env.kimiModel || "kimi-k2.6",
    });

    try {
      const response = await withAbortableTimeout(
        signal =>
          fetch(`${getBaseUrl()}/v1/chat/completions`, {
            method: "POST",
            signal,
            headers: {
              Authorization: `Bearer ${getApiKey()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: env.kimiModel || "kimi-k2.6",
              messages: params.messages,
              safety_identifier: `user-${params.userId}`,
              max_completion_tokens: 800,
              thinking: {
                type: "disabled",
              },
            }),
          }),
        {
          label: "Kimi direct request",
          timeoutMs: 45_000,
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Kimi direct request failed (${response.status}): ${body.slice(0, 500)}`,
        );
      }

      const payload = (await response.json()) as KimiResponsePayload;
      const content = payload.choices?.[0]?.message?.content?.trim() ?? "";

      if (!content) {
        throw new Error("Kimi returned an empty assistant message.");
      }

      logServerDebug("kimi.direct.request.success", {
        userId: params.userId,
        model: payload.model ?? env.kimiModel ?? "kimi-k2.6",
        outputTokens: payload.usage?.completion_tokens,
      });

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
    } catch (error) {
      logServerError("kimi.direct.request.failed", error, {
        userId: params.userId,
        model: env.kimiModel || "kimi-k2.6",
      });
      throw error;
    }
  }
}

import { env } from "../lib/env.js";
import type { KimiChatRequest } from "./chat-client.js";

type KimiCompletionResponse = {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cached_tokens?: number;
  };
};

type StreamHandlers = {
  onTextDelta?: (delta: string) => void | Promise<void>;
};

type KimiUploadedFile = {
  id: string;
  object?: string;
  bytes?: number;
  filename?: string;
};

function getBaseUrl() {
  return env.kimiOpenUrl.replace(/\/$/, "");
}

function getApiKey() {
  if (!env.kimiApiKey) {
    throw new Error(
      "KIMI_API_KEY is missing. Add it to app/.env before using Kimi V1.",
    );
  }

  return env.kimiApiKey;
}

async function kimiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Kimi request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return response;
}

export class KimiApiClient {
  async createChatCompletion(request: KimiChatRequest) {
    const response = await kimiFetch("/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    return (await response.json()) as KimiCompletionResponse;
  }

  async streamChatCompletion(request: KimiChatRequest, handlers: StreamHandlers) {
    const response = await kimiFetch("/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...request,
        stream: true,
      }),
    });

    if (!response.body) {
      throw new Error("Kimi streaming response did not include a readable body.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalPayload: KimiCompletionResponse = {};

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const parsed = parseKimiSseBuffer(buffer);
      buffer = parsed.remainder;

      for (const payload of parsed.payloads) {
        const choice = payload.choices?.[0];
        const delta = choice && "delta" in choice ? (choice as { delta?: { content?: string } }).delta : undefined;
        if (delta?.content) {
          await handlers.onTextDelta?.(delta.content);
        }

        if (choice?.finish_reason) {
          finalPayload = {
            ...payload,
            choices: [
              {
                finish_reason: choice.finish_reason,
                message: {
                  role: "assistant",
                  content:
                    (finalPayload.choices?.[0]?.message?.content ?? "") +
                    collectedContentFromPayloads(parsed.payloads),
                },
              },
            ],
          };
        }
      }

      if (done) {
        break;
      }
    }

    if (!finalPayload.choices?.[0]?.message?.content) {
      const allContent = collectedContentFromPayloads(parseKimiSseBuffer(buffer).payloads);
      finalPayload = {
        ...finalPayload,
        choices: [
          {
            finish_reason: finalPayload.choices?.[0]?.finish_reason ?? "stop",
            message: {
              role: "assistant",
              content: allContent,
            },
          },
        ],
      };
    }

    return finalPayload;
  }

  async uploadFile(params: {
    filename: string;
    contentType: string;
    bytes: Uint8Array;
    purpose?: "file-extract";
  }) {
    const form = new FormData();
    const fileBytes = Uint8Array.from(params.bytes);
    const blob = new Blob([fileBytes], { type: params.contentType });
    form.append("file", blob, params.filename);
    form.append("purpose", params.purpose ?? "file-extract");

    const response = await kimiFetch("/v1/files", {
      method: "POST",
      body: form,
    });

    return (await response.json()) as KimiUploadedFile;
  }

  async getFileContent(fileId: string) {
    const response = await kimiFetch(`/v1/files/${fileId}/content`);
    return await response.text();
  }

  async deleteFile(fileId: string) {
    await kimiFetch(`/v1/files/${fileId}`, {
      method: "DELETE",
    });
  }
}

function parseKimiSseBuffer(buffer: string) {
  const blocks = buffer.split("\n\n");
  const remainder = blocks.pop() ?? "";
  const payloads: Array<Record<string, any>> = [];

  for (const block of blocks) {
    const payload = block
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .join("\n");

    if (!payload || payload === "[DONE]") {
      continue;
    }

    try {
      payloads.push(JSON.parse(payload));
    } catch {
      // Ignore partial chunks and rely on the next SSE frame.
    }
  }

  return {
    payloads,
    remainder,
  };
}

function collectedContentFromPayloads(payloads: Array<Record<string, any>>) {
  return payloads
    .map(payload => payload?.choices?.[0]?.delta?.content)
    .filter((value): value is string => typeof value === "string")
    .join("");
}

export type { KimiCompletionResponse, KimiUploadedFile };

import { buildAuthenticatedHeaders, type SessionReader } from "@/lib/request-auth";
import type { Message } from "@/types";

const KIMI_CHAT_REQUEST_TIMEOUT_MS = 35_000;

type KimiChatResponse = {
  message: {
    content: string;
    metadata?: Message["metadata"];
  };
};

export async function postKimiChatMessage(params: {
  readAccessToken: SessionReader;
  agentId: string;
  content: string;
  systemPrompt: string;
}) {
  const headers = await buildAuthenticatedHeaders(params.readAccessToken, {
    "Content-Type": "application/json",
  });
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = await Promise.race([
      fetch("/api/kimi/chat", {
        method: "POST",
        credentials: "include",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          agentId: params.agentId,
          content: params.content,
          systemPrompt: params.systemPrompt,
        }),
      }),
      new Promise<Response>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(
            new Error(
              `Kimi chat request timed out after ${KIMI_CHAT_REQUEST_TIMEOUT_MS}ms.`,
            ),
          );
        }, KIMI_CHAT_REQUEST_TIMEOUT_MS);
      }),
    ]);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(
        payload?.error ?? `Kimi chat failed with HTTP ${response.status}.`,
      );
    }

    return (await response.json()) as KimiChatResponse;
  } catch (issue) {
    if (issue instanceof Error && issue.name === "AbortError") {
      throw new Error(
        `Kimi chat request timed out after ${KIMI_CHAT_REQUEST_TIMEOUT_MS}ms.`,
      );
    }

    throw issue;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

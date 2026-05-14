import type {
  ChatStreamErrorEvent,
  ChatStreamEvent,
  ChatStreamResponseMetadata,
  ChatStreamWatchdog,
  ChatStreamWatchdogOptions,
} from "@contracts/chat-stream";

function isChatStreamEvent(value: unknown): value is ChatStreamEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { type?: string };
  return (
    candidate.type === "ack" ||
    candidate.type === "stage" ||
    candidate.type === "text-delta" ||
    candidate.type === "message-complete" ||
    candidate.type === "error"
  );
}

export function encodeChatStreamEvent(event: ChatStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

export function isRecoverableChatStreamStatus(status: number) {
  return (
    status === 404 ||
    status === 405 ||
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

export function isRecoverableChatStreamError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }

  const normalized = error.message.trim().toLowerCase();

  if (
    normalized.includes("this operation was aborted") ||
    normalized.includes("bodystreambuffer was aborted") ||
    normalized.includes("was aborted") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("timed out")
  ) {
    return true;
  }

  const statusMatch = normalized.match(/http\s+(\d{3})/);
  if (!statusMatch) {
    return false;
  }

  return isRecoverableChatStreamStatus(Number(statusMatch[1]));
}

export function createChatStreamWatchdog(
  timeoutMs: number,
  label = "Chat stream",
  options: ChatStreamWatchdogOptions = {},
): ChatStreamWatchdog {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const arm = (nextTimeoutMs: number) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort(new Error(`${label} timed out after ${timeoutMs}ms.`));
      }
    }, nextTimeoutMs);
  };

  arm(options.initialTimeoutMs ?? timeoutMs);

  return {
    signal: controller.signal,
    touch() {
      if (controller.signal.aborted) {
        return;
      }

      arm(timeoutMs);
    },
    abort(reason) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!controller.signal.aborted) {
        controller.abort(
          new Error(reason ?? `${label} aborted before completion.`),
        );
      }
    },
    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
  };
}

export function parseChatStreamChunk(buffer: string) {
  const lines = buffer.split("\n");
  const remainder = lines.pop() ?? "";
  const events: ChatStreamEvent[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (isChatStreamEvent(parsed)) {
        events.push(parsed);
      }
    } catch {
      // Ignore malformed lines and leave recovery to the next valid event.
    }
  }

  return {
    events,
    remainder,
  };
}

export function readChatStreamResponseMetadata(
  response: Response,
): ChatStreamResponseMetadata {
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    traceId: response.headers.get("x-trace-id"),
  };
}

export function createMalformedStreamError(input: {
  bodyPreview: string;
  status: number;
  contentType?: string | null;
  traceId?: string | null;
}) {
  const bodyPreview = input.bodyPreview.trim().slice(0, 300);
  const normalizedPreview = bodyPreview.toLowerCase();
  const normalizedContentType = input.contentType?.toLowerCase() ?? "";
  const category =
    input.status >= 500 ||
    normalizedPreview.includes("an error occurred") ||
    normalizedPreview.includes("<!doctype html") ||
    normalizedPreview.includes("<html")
      ? "backend-timeout"
      : "transport";
  const error = new Error(
    `Chat stream returned malformed content (${input.status}, ${
      input.contentType || "unknown content-type"
    }).`,
  ) as Error & {
    category?: ChatStreamErrorEvent["category"];
    traceId?: string;
    bodyPreview?: string;
    contentType?: string | null;
  };

  error.category = normalizedContentType.includes("text/html")
    ? "backend-timeout"
    : category;
  error.traceId = input.traceId ?? undefined;
  error.bodyPreview = bodyPreview;
  error.contentType = input.contentType ?? null;
  return error;
}

export type {
  ChatStreamAckEvent,
  ChatStreamEvent,
  ChatStreamErrorEvent,
  ChatStreamMessageCompleteEvent,
  ChatStreamStageEvent,
  ChatStreamTextDeltaEvent,
  ChatStreamResponseMetadata,
  ChatStreamWatchdog,
  ChatStreamWatchdogOptions,
} from "@contracts/chat-stream";

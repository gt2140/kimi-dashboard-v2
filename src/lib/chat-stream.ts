type ChatStreamStageEvent = {
  type: "stage";
  stageId: string;
  label: string;
};

type ChatStreamTextDeltaEvent = {
  type: "text-delta";
  delta: string;
};

type ChatStreamMessageCompleteEvent = {
  type: "message-complete";
  message: {
    id: string;
    role: "assistant";
    content: string;
    agentId: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  };
};

type ChatStreamErrorEvent = {
  type: "error";
  message: string;
};

type ChatStreamEvent =
  | ChatStreamStageEvent
  | ChatStreamTextDeltaEvent
  | ChatStreamMessageCompleteEvent
  | ChatStreamErrorEvent;

function isChatStreamEvent(value: unknown): value is ChatStreamEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { type?: string };
  return (
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
  return status === 404 || status === 405;
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

export type {
  ChatStreamEvent,
  ChatStreamErrorEvent,
  ChatStreamMessageCompleteEvent,
  ChatStreamStageEvent,
  ChatStreamTextDeltaEvent,
};

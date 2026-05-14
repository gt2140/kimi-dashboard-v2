export type ChatStreamAckEvent = {
  type: "ack";
  traceId: string;
};

export type ChatStreamStageEvent = {
  type: "stage";
  stageId: string;
  label: string;
};

export type ChatStreamTextDeltaEvent = {
  type: "text-delta";
  delta: string;
};

export type ChatStreamMessageCompleteEvent = {
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

export type ChatStreamErrorCategory =
  | "auth"
  | "transport"
  | "backend-timeout"
  | "provider-timeout"
  | "provider-error"
  | "db-error"
  | "context-error";

export type ChatStreamErrorEvent = {
  type: "error";
  message: string;
  category?: ChatStreamErrorCategory;
  traceId?: string;
};

export type ChatStreamEvent =
  | ChatStreamAckEvent
  | ChatStreamStageEvent
  | ChatStreamTextDeltaEvent
  | ChatStreamMessageCompleteEvent
  | ChatStreamErrorEvent;

export type ChatStreamWatchdogOptions = {
  initialTimeoutMs?: number;
};

export type ChatStreamResponseMetadata = {
  status: number;
  contentType: string | null;
  traceId: string | null;
};

export type ChatStreamWatchdog = {
  signal: AbortSignal;
  touch: () => void;
  abort: (reason?: string) => void;
  cancel: () => void;
};

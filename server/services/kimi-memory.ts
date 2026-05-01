type MemoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type StableMemoryRecord = {
  key: string;
  value: string;
  confidence?: number | null;
};

export function buildKimiPromptCacheKey(conversationId: number | string) {
  return `kimi:v1:conversation:${conversationId}`;
}

export function buildShortTermMemoryWindow(input: {
  summary?: string | null;
  messages: MemoryMessage[];
  maxRecentMessages?: number;
}) {
  const maxRecentMessages = Math.max(1, input.maxRecentMessages ?? 8);
  const recentMessages = input.messages.slice(-maxRecentMessages);

  return {
    summaryBlock: input.summary?.trim()
      ? `Conversation summary:\n${input.summary.trim()}`
      : "",
    recentMessages,
  };
}

export function buildLongTermMemorySnippet(records: StableMemoryRecord[]) {
  if (records.length === 0) {
    return "";
  }

  const lines = records.map((record) => {
    const confidence =
      typeof record.confidence === "number"
        ? ` (confidence ${record.confidence.toFixed(2)})`
        : "";
    return `- ${record.key}: ${record.value}${confidence}`;
  });

  return `User memory:\n${lines.join("\n")}`;
}

export type { MemoryMessage, StableMemoryRecord };

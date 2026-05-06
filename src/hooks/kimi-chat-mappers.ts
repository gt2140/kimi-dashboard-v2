import type { ChatSession, Message } from "@/types";

export function mapConversationSummary(item: {
  id: number;
  agentId: string;
  title: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  calledAgentIds?: string[];
}): ChatSession {
  return {
    id: String(item.id),
    agentId: item.agentId,
    calledAgentIds: item.calledAgentIds ?? [],
    title: item.title || "New conversation",
    messages: [],
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

export function mapMessage(item: {
  id: number;
  role: "user" | "assistant";
  content: string;
  agentId: string | null;
  createdAt: Date | string;
  metadata?: Message["metadata"];
}): Message {
  return {
    id: String(item.id),
    role: item.role,
    content: item.content,
    agentId: item.agentId ?? "generalist",
    timestamp: new Date(item.createdAt),
    metadata: item.metadata,
  };
}

export function findLastMatchingUserIndex(
  items: Array<{
    role: "user" | "assistant";
    content: string;
  }>,
  target: string,
) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.role === "user" && item.content === target) {
      return index;
    }
  }

  return -1;
}

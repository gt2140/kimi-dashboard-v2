import type { Message } from "@/types";

type StreamingAssistant = {
  content: string;
  metadata?: Message["metadata"];
};

export function buildKimiChatTimeline(input: {
  messages: Message[];
  activeAgentId: string;
  pendingUserMessage?: string | null;
  streamingAssistant?: StreamingAssistant | null;
}) {
  const timeline: Message[] = [...input.messages];

  if (input.pendingUserMessage?.trim()) {
    timeline.push({
      id: "pending-user",
      role: "user",
      content: input.pendingUserMessage.trim(),
      agentId: input.activeAgentId,
      timestamp: new Date(),
    });
  }

  if (input.streamingAssistant?.content.trim()) {
    timeline.push({
      id: "kimi-streaming",
      role: "assistant",
      content: input.streamingAssistant.content,
      agentId: input.activeAgentId,
      timestamp: new Date(),
      metadata: input.streamingAssistant.metadata,
    });
  }

  return timeline;
}


import type { ChatAssistantMetadata } from "@contracts/chat-metadata";

export type ConversationTurnRuntimeStage = {
  id: string;
  label: string;
};

export type ConversationTurnRuntimeInput = {
  userId: number;
  conversationId: number;
  content: string;
  agentId: string;
  requestedModelName?: string | null;
  stream: boolean;
  signal?: AbortSignal | null;
  onStage?: (stage: ConversationTurnRuntimeStage) => void | Promise<void>;
  onTextDelta?: (delta: string) => void | Promise<void>;
};

export type ConversationTurnRuntimeResult = {
  success: true;
  assistantMessage: {
    id: number;
    role: "assistant";
    content: string;
    agentId: string;
    createdAt: Date;
    metadata?: ChatAssistantMetadata;
  };
};

export type ConversationTurnRuntime = {
  executeTurn(
    input: ConversationTurnRuntimeInput
  ): Promise<ConversationTurnRuntimeResult>;
};

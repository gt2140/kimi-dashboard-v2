import { findLastMatchingUserIndex } from "@/hooks/kimi-chat-mappers";

type ConversationSnapshot = {
  messages?: Array<{
    id: number;
    role: "user" | "assistant";
    content: string;
    agentId: string | null;
    createdAt: Date | string;
    metadata?: Record<string, unknown>;
  }>;
};

export function createPersistedCompletionReader(input: {
  conversationId: number;
  userMessage: string;
  activeAgentId: string;
  pollAttempts: number;
  pollDelayMs: number;
  invalidateConversation: (args: { id: number }) => Promise<unknown>;
  fetchConversation: (args: { id: number }) => Promise<ConversationSnapshot | undefined>;
  onRecoveredMessage?: (message: {
    id: string;
    role: "assistant";
    content: string;
    agentId: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }) => void;
}) {
  return async function readPersistedCompletion() {
    const normalizedTarget = input.userMessage.trim();

    for (let attempt = 0; attempt < input.pollAttempts; attempt += 1) {
      await input.invalidateConversation({ id: input.conversationId });
      const snapshot = await input.fetchConversation({
        id: input.conversationId,
      });
      const conversationMessages = snapshot?.messages ?? [];
      const normalizedMessages = conversationMessages.map(message => ({
        role: message.role,
        content:
          typeof message.content === "string" ? message.content.trim() : "",
      }));
      const matchingUserIndex = findLastMatchingUserIndex(
        normalizedMessages,
        normalizedTarget,
      );

      if (matchingUserIndex >= 0) {
        const persistedAssistant = conversationMessages
          .slice(matchingUserIndex + 1)
          .find(message => message.role === "assistant");

        if (persistedAssistant) {
          const recoveredMessage = {
            id: String(persistedAssistant.id),
            role: "assistant" as const,
            content: persistedAssistant.content,
            agentId: persistedAssistant.agentId ?? input.activeAgentId,
            createdAt:
              persistedAssistant.createdAt instanceof Date
                ? persistedAssistant.createdAt.toISOString()
                : new Date(persistedAssistant.createdAt).toISOString(),
            metadata: persistedAssistant.metadata,
          };

          input.onRecoveredMessage?.(recoveredMessage);
          return recoveredMessage;
        }
      }

      if (attempt < input.pollAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, input.pollDelayMs));
      }
    }

    return null;
  };
}

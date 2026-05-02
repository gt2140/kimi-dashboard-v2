import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatSession, Message } from "@/types";

type LocalChatStore = {
  conversations: ChatSession[];
  createConversation: (agentId: string, firstMessage: string) => ChatSession;
  appendTurn: (
    conversationId: string | null,
    agentId: string,
    content: string,
  ) => ChatSession;
  deleteConversation: (conversationId: string) => void;
  getConversation: (conversationId: string | null) => ChatSession | null;
  clearAll: () => void;
};

function createId() {
  return String(Date.now() + Math.floor(Math.random() * 1000));
}

function buildTitle(content: string) {
  const trimmed = content.trim();
  return trimmed.slice(0, 60) + (trimmed.length > 60 ? "..." : "");
}

function buildAssistantMessage(agentId: string): Message {
  return {
    id: createId(),
    role: "assistant",
    content:
      "Frontend-only mode. El backend todavia no fue reconstruido. Esta respuesta local existe para validar la UI, la navegacion y el flujo de mensajes mientras limpiamos la base del proyecto.",
    agentId,
    timestamp: new Date(),
    metadata: {
      note: "local-frontend-only",
      responseMode: "limited",
    },
  };
}

export const useLocalChatStore = create<LocalChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      createConversation: (agentId, firstMessage) => {
        const now = new Date();
        const conversation: ChatSession = {
          id: createId(),
          agentId,
          title: buildTitle(firstMessage) || "New conversation",
          messages: [],
          createdAt: now,
          updatedAt: now,
        };

        set(state => ({
          conversations: [conversation, ...state.conversations],
        }));

        return conversation;
      },
      appendTurn: (conversationId, agentId, content) => {
        const resolvedConversation =
          get().getConversation(conversationId) ??
          get().createConversation(agentId, content);

        const userMessage: Message = {
          id: createId(),
          role: "user",
          content,
          agentId,
          timestamp: new Date(),
        };
        const assistantMessage = buildAssistantMessage(agentId);

        const nextConversation: ChatSession = {
          ...resolvedConversation,
          agentId,
          title:
            resolvedConversation.title === "New conversation"
              ? buildTitle(content)
              : resolvedConversation.title,
          updatedAt: assistantMessage.timestamp,
          messages: [
            ...resolvedConversation.messages,
            userMessage,
            assistantMessage,
          ],
        };

        set(state => ({
          conversations: [
            nextConversation,
            ...state.conversations.filter(
              conversation => conversation.id !== nextConversation.id,
            ),
          ],
        }));

        return nextConversation;
      },
      deleteConversation: conversationId =>
        set(state => ({
          conversations: state.conversations.filter(
            conversation => conversation.id !== conversationId,
          ),
        })),
      getConversation: conversationId => {
        if (!conversationId) {
          return null;
        }

        return (
          get().conversations.find(
            conversation => conversation.id === conversationId,
          ) ?? null
        );
      },
      clearAll: () => set({ conversations: [] }),
    }),
    {
      name: "local-chat-store",
    },
  ),
);

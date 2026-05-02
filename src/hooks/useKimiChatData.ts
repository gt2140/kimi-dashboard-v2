import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useChatStore } from "@/hooks/useStore";
import { useLocalChatStore } from "@/hooks/useLocalChatStore";
import { postKimiChatMessage } from "@/lib/kimi-chat-api";
import { buildAuthenticatedHeaders } from "@/lib/request-auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { ChatSession, Message } from "@/types";
import { AGENTS } from "@/lib/data";

function reviveMessage(message: Message): Message {
  return {
    ...message,
    timestamp: new Date(message.timestamp),
  };
}

function reviveConversation(conversation: ChatSession): ChatSession {
  return {
    ...conversation,
    createdAt: new Date(conversation.createdAt),
    updatedAt: new Date(conversation.updatedAt),
    messages: conversation.messages.map(reviveMessage),
  };
}

export function useKimiChatData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const hydrateConversation = useChatStore(state => state.hydrateConversation);
  const clearChatStore = useChatStore(state => state.clearChat);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const rawConversationId = searchParams.get("conversation");
  const activeConversationId = rawConversationId;

  const storedConversations = useLocalChatStore(state => state.conversations);
  const saveTurn = useLocalChatStore(state => state.saveTurn);
  const deleteConversation = useLocalChatStore(state => state.deleteConversation);
  const getConversation = useLocalChatStore(state => state.getConversation);

  const conversations = useMemo(
    () => storedConversations.map(reviveConversation),
    [storedConversations],
  );
  const activeConversation = useMemo(() => {
    const resolved = getConversation(activeConversationId);
    return resolved ? reviveConversation(resolved) : null;
  }, [activeConversationId, getConversation, storedConversations]);

  const sessions = useMemo(
    () =>
      conversations.map(conversation => ({
        id: conversation.id,
        agentId: conversation.agentId,
        title: conversation.title,
        messages: [],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      })),
    [conversations],
  );

  const messages = activeConversation?.messages ?? [];

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    if (!activeConversation) {
      clearChatStore();
      setSearchParams({});
      navigate("/kimi/chat", { replace: true });
      return;
    }

    hydrateConversation({
      sessionId: Number(activeConversation.id),
      agentId: activeConversation.agentId,
    });
  }, [
    activeConversation,
    activeConversationId,
    clearChatStore,
    hydrateConversation,
    navigate,
    setSearchParams,
  ]);

  async function selectConversation(sessionId: string) {
    setSearchParams({ conversation: sessionId });
    navigate(`/kimi/chat?conversation=${sessionId}`);
  }

  async function startNewChat(agentId?: string) {
    const nextAgentId = agentId ?? activeAgentId;
    setActiveAgent(nextAgentId);
    clearChatStore();
    setSearchParams({});
    navigate("/kimi/chat");
  }

  async function readAccessToken() {
    if (!isSupabaseConfigured) {
      return null;
    }

    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function sendMessage(content: string) {
    if (!content.trim()) {
      return null;
    }

    setError(null);
    setIsSending(true);

    try {
      const activeAgent =
        AGENTS.find(agent => agent.id === activeAgentId) ?? AGENTS[0];
      const payload = await postKimiChatMessage({
        readAccessToken,
        agentId: activeAgentId,
        content: content.trim(),
        systemPrompt: activeAgent.systemPrompt,
      });

      const conversation = saveTurn({
        conversationId: activeConversationId,
        agentId: activeAgentId,
        userContent: content.trim(),
        assistantContent: payload.message.content,
        assistantMetadata: payload.message.metadata,
      });

      if (activeConversationId !== conversation.id) {
        setSearchParams({ conversation: conversation.id });
        navigate(`/kimi/chat?conversation=${conversation.id}`, {
          replace: true,
        });
      }

      return conversation.messages[conversation.messages.length - 1] ?? null;
    } catch (issue) {
      const message =
        issue instanceof Error
          ? issue.message
          : "No pudimos guardar este mensaje en el modo local.";
      setError(message);
      throw issue;
    } finally {
      setIsSending(false);
    }
  }

  async function runBackendCheck() {
    setError(null);
    setIsSending(true);

    try {
      const headers = await buildAuthenticatedHeaders(readAccessToken, {
        "Content-Type": "application/json",
      });
      const response = await fetch("/api/kimi/chat/debug", {
        method: "POST",
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error ?? `Kimi backend check failed with HTTP ${response.status}.`,
        );
      }

      const payload = (await response.json()) as {
        ok: boolean;
        message: {
          content: string;
          metadata?: Message["metadata"];
        };
      };

      const conversation = saveTurn({
        conversationId: activeConversationId,
        agentId: activeAgentId,
        userContent: "Run backend Kimi check",
        assistantContent: payload.message.content,
        assistantMetadata: payload.message.metadata,
      });

      if (activeConversationId !== conversation.id) {
        setSearchParams({ conversation: conversation.id });
        navigate(`/kimi/chat?conversation=${conversation.id}`, {
          replace: true,
        });
      }

      return conversation.messages[conversation.messages.length - 1] ?? null;
    } catch (issue) {
      const message =
        issue instanceof Error
          ? issue.message
          : "No pudimos ejecutar la verificacion del backend.";
      setError(message);
      throw issue;
    } finally {
      setIsSending(false);
    }
  }

  async function removeConversation(sessionId: string) {
    deleteConversation(sessionId);

    if (activeConversationId === sessionId) {
      clearChatStore();
      setSearchParams({});
      navigate("/kimi/chat", { replace: true });
    }
  }

  return {
    sessions,
    messages,
    activeConversationId: activeConversationId ? Number(activeConversationId) : null,
    isConversationLoading: false,
    isSending,
    error,
    selectConversation,
    startNewChat,
    sendMessage,
    runBackendCheck,
    removeConversation,
  };
}

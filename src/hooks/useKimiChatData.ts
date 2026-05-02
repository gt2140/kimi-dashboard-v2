import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ensureBackendSession, trpc } from "@/providers/trpc";
import { useChatStore } from "@/hooks/useStore";
import { formatRuntimeError } from "@/lib/app-errors";
import { buildAuthenticatedHeaders } from "@/lib/request-auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { ChatSession, Message } from "@/types";

function mapConversationSummary(item: {
  id: number;
  agentId: string;
  title: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): ChatSession {
  return {
    id: String(item.id),
    agentId: item.agentId,
    title: item.title || "New conversation",
    messages: [],
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

function mapMessage(item: {
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

export function useKimiChatData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const hydrateConversation = useChatStore(state => state.hydrateConversation);
  const clearChatStore = useChatStore(state => state.clearChat);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const rawConversationId = searchParams.get("conversation");
  const activeConversationId = rawConversationId
    ? Number(rawConversationId)
    : null;
  const authedQueriesEnabled = true;

  const utils = trpc.useUtils();
  const conversationsQuery = trpc.chat.listConversations.useQuery(undefined, {
    enabled: authedQueriesEnabled,
    retry: false,
  });
  const conversationQuery = trpc.chat.getConversation.useQuery(
    { id: activeConversationId ?? 0 },
    {
      enabled: activeConversationId !== null && authedQueriesEnabled,
      retry: false,
    },
  );
  const deleteConversationMutation = trpc.chat.deleteConversation.useMutation();

  const sessions = useMemo(
    () => (conversationsQuery.data ?? []).map(mapConversationSummary),
    [conversationsQuery.data],
  );

  const messages = useMemo(
    () => (conversationQuery.data?.messages ?? []).map(mapMessage),
    [conversationQuery.data?.messages],
  );

  useEffect(() => {
    const conversation = conversationQuery.data?.conversation;
    if (!conversation) {
      return;
    }

    hydrateConversation({
      sessionId: conversation.id,
      agentId: conversation.agentId,
    });
  }, [conversationQuery.data?.conversation, hydrateConversation]);

  useEffect(() => {
    if (activeConversationId === null || !conversationQuery.error) {
      return;
    }

    const message =
      conversationQuery.error instanceof Error
        ? conversationQuery.error.message
        : String(conversationQuery.error);

    if (!message.toLowerCase().includes("conversation not found")) {
      return;
    }

    clearChatStore();
    setSearchParams({});
    navigate("/kimi/chat", { replace: true });
  }, [
    activeConversationId,
    clearChatStore,
    conversationQuery.error,
    navigate,
    setSearchParams,
  ]);

  async function readAccessToken() {
    if (!isSupabaseConfigured) {
      return null;
    }

    const { data } = await getSupabaseBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  }

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

  async function sendMessage(content: string) {
    setStreamError(null);
    setIsStreaming(true);

    try {
      async function requestResponse(forceSessionRefresh = false) {
        if (forceSessionRefresh) {
          await ensureBackendSession({ force: true });
        }

        const headers = await buildAuthenticatedHeaders(readAccessToken, {
          "Content-Type": "application/json",
        });
        return fetch("/api/kimi/chat", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            conversationId: activeConversationId ?? undefined,
            content,
            agentId: activeAgentId,
          }),
        });
      }

      let response = await requestResponse();

      if (response.status === 401) {
        response = await requestResponse(true);
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error ?? `Kimi chat failed with HTTP ${response.status}.`,
        );
      }

      const payload = (await response.json()) as {
        conversationId: number;
        message: {
          id: string;
          role: "assistant";
          content: string;
          agentId: string;
          createdAt: string;
          metadata?: Record<string, unknown>;
        };
      };

      if (activeConversationId !== payload.conversationId) {
        setSearchParams({ conversation: String(payload.conversationId) });
        navigate(`/kimi/chat?conversation=${payload.conversationId}`, {
          replace: true,
        });
      }

      await Promise.all([
        utils.chat.listConversations.invalidate(),
        utils.chat.getConversation.invalidate({ id: payload.conversationId }),
      ]);

      return payload.message;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Kimi chat failed unexpectedly.";
      setStreamError(message);
      throw error;
    } finally {
      setIsStreaming(false);
    }
  }

  async function removeConversation(sessionId: string) {
    const numericId = Number(sessionId);
    await deleteConversationMutation.mutateAsync({ id: numericId });

    if (activeConversationId === numericId) {
      clearChatStore();
      setSearchParams({});
      navigate("/kimi/chat");
      await utils.chat.getConversation.invalidate({ id: numericId });
    }

    await utils.chat.listConversations.invalidate();
  }

  const error =
    streamError ??
    deleteConversationMutation.error ??
    conversationsQuery.error ??
    conversationQuery.error ??
    null;

  return {
    sessions,
    messages,
    activeConversationId,
    isConversationLoading: conversationQuery.isLoading,
    isSending: isStreaming,
    error:
      typeof error === "string"
        ? error
        : error
          ? formatRuntimeError(error, "Kimi chat")
          : null,
    selectConversation,
    startNewChat,
    sendMessage,
    removeConversation,
  };
}

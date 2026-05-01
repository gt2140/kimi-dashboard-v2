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
  const createConversation = trpc.chat.createConversation.useMutation();
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
      calledAgentIds: conversation.calledAgentIds ?? [],
    });
  }, [conversationQuery.data?.conversation, hydrateConversation]);

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

  async function ensureConversationId(firstMessage?: string) {
    if (activeConversationId !== null) {
      return activeConversationId;
    }

    const created = await createConversation.mutateAsync({
      agentId: activeAgentId,
      title: firstMessage ? firstMessage.slice(0, 60) : undefined,
    });
    const nextId = created.id;
    setSearchParams({ conversation: String(nextId) });
    navigate(`/kimi/chat?conversation=${nextId}`);
    return nextId;
  }

  async function streamMessage(
    content: string,
    handlers: {
      onTextDelta?: (delta: string) => void;
      onMessageComplete?: (message: {
        id: string;
        role: "assistant";
        content: string;
        agentId: string;
        createdAt: string;
        metadata?: Record<string, unknown>;
      }) => void;
    } = {},
  ) {
    const conversationId = await ensureConversationId(content);

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
        return fetch("/api/kimi/chat/respond", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            conversationId,
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
        message: {
          id: string;
          role: "assistant";
          content: string;
          agentId: string;
          createdAt: string;
          metadata?: Record<string, unknown>;
        };
      };

      handlers.onTextDelta?.(payload.message.content);
      handlers.onMessageComplete?.(payload.message);

      await Promise.all([
        utils.chat.listConversations.invalidate(),
        utils.chat.getConversation.invalidate({ id: conversationId }),
      ]);

      return payload.message;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Kimi streaming failed unexpectedly.";
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
    createConversation.error ??
    deleteConversationMutation.error ??
    conversationsQuery.error ??
    conversationQuery.error ??
    null;

  return {
    sessions,
    messages,
    activeConversationId,
    isConversationLoading: conversationQuery.isLoading,
    isSending: isStreaming || createConversation.isPending,
    error:
      typeof error === "string"
        ? error
        : error
          ? formatRuntimeError(error, "Kimi chat")
          : null,
    selectConversation,
    startNewChat,
    streamMessage,
    removeConversation,
  };
}

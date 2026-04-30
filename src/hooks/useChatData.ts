import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ensureBackendSession, trpc } from "@/providers/trpc";
import { useChatStore } from "@/hooks/useStore";
import { formatRuntimeError } from "@/lib/app-errors";
import { logClientDebug, logClientError } from "@/lib/debug";
import { buildAuthenticatedHeaders } from "@/lib/request-auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  isRecoverableChatStreamStatus,
  parseChatStreamChunk,
  type ChatStreamEvent,
} from "@/lib/chat-stream";
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

function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { data?: { code?: string }; message?: string };
  return (
    candidate.data?.code === "UNAUTHORIZED" ||
    candidate.message?.toLowerCase().includes("unauth") === true
  );
}

export function useChatData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const calledAgentIds = useChatStore(state => state.calledAgentIds);
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const hydrateConversation = useChatStore(state => state.hydrateConversation);
  const clearChatStore = useChatStore(state => state.clearChat);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const rawConversationId = searchParams.get("conversation");
  const activeConversationId = rawConversationId
    ? Number(rawConversationId)
    : null;

  const utils = trpc.useUtils();
  const conversationsQuery = trpc.chat.listConversations.useQuery();
  const conversationQuery = trpc.chat.getConversation.useQuery(
    { id: activeConversationId ?? 0 },
    {
      enabled: activeConversationId !== null,
      retry: false,
    }
  );

  const createConversation = trpc.chat.createConversation.useMutation();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();
  const deleteConversationMutation = trpc.chat.deleteConversation.useMutation();

  const sessions = useMemo(
    () => (conversationsQuery.data ?? []).map(mapConversationSummary),
    [conversationsQuery.data]
  );

  const messages = useMemo(
    () => (conversationQuery.data?.messages ?? []).map(mapMessage),
    [conversationQuery.data?.messages]
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

  async function runWithAuthSyncRetry<T>(
    label: string,
    action: () => Promise<T>
  ) {
    const synced = await ensureBackendSession();
    if (!synced) {
      throw new Error(
        "Your browser session exists, but the backend session is not ready yet."
      );
    }

    try {
      logClientDebug(`chat.${label}.attempt`);
      return await action();
    } catch (error) {
      logClientError(`chat.${label}.failed`, error);
      if (!isUnauthorizedError(error)) {
        throw error;
      }

      logClientDebug(`chat.${label}.retry-after-auth-sync`);
      const retrySynced = await ensureBackendSession({ force: true });
      if (!retrySynced) {
        throw error;
      }
      return action();
    }
  }

  async function selectConversation(sessionId: string) {
    setSearchParams({ conversation: sessionId });
    navigate(`/chat?conversation=${sessionId}`);
  }

  async function startNewChat(agentId?: string) {
    const nextAgentId = agentId ?? activeAgentId;
    setActiveAgent(nextAgentId);
    clearChatStore();
    setSearchParams({});
    navigate("/chat");
  }

  async function ensureConversationId(firstMessage?: string) {
    if (activeConversationId !== null) {
      return activeConversationId;
    }

    const created = await runWithAuthSyncRetry("create-conversation", () =>
      createConversation.mutateAsync({
        agentId: activeAgentId,
        title: firstMessage ? firstMessage.slice(0, 60) : undefined,
      })
    );
    const nextId = created.id;
    setSearchParams({ conversation: String(nextId) });
    navigate(`/chat?conversation=${nextId}`);
    return nextId;
  }

  async function sendMessageToConversation(
    conversationId: number,
    content: string
  ) {
    const result = await runWithAuthSyncRetry("send-message", () =>
      sendMessageMutation.mutateAsync({
        conversationId,
        content,
        agentId: activeAgentId,
        calledAgentIds,
      })
    );
    await Promise.all([
      utils.chat.listConversations.invalidate(),
      utils.chat.getConversation.invalidate({ id: conversationId }),
    ]);
    return result;
  }

  async function sendMessage(content: string) {
    const conversationId = await ensureConversationId(content);
    return sendMessageToConversation(conversationId, content);
  }

  async function streamMessage(
    content: string,
    handlers: {
      onEvent?: (event: ChatStreamEvent) => void;
      onStage?: (stage: Extract<ChatStreamEvent, { type: "stage" }>) => void;
      onTextDelta?: (
        event: Extract<ChatStreamEvent, { type: "text-delta" }>
      ) => void;
      onMessageComplete?: (
        event: Extract<ChatStreamEvent, { type: "message-complete" }>
      ) => void;
    } = {}
  ) {
    const conversationId = await ensureConversationId(content);
    const synced = await ensureBackendSession();

    if (!synced) {
      throw new Error(
        "Your browser session exists, but the backend session is not ready yet."
      );
    }

    setStreamError(null);
    setIsStreaming(true);

    try {
      const makeStreamRequest = () =>
        buildAuthenticatedHeaders(readAccessToken, {
          "Content-Type": "application/json",
        }).then((headers) =>
          fetch("/api/chat/stream", {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({
              conversationId,
              content,
              agentId: activeAgentId,
              calledAgentIds,
            }),
          })
        );

      let response = await makeStreamRequest();

      if (response.status === 401) {
        const retrySynced = await ensureBackendSession({ force: true });
        if (retrySynced) {
          response = await makeStreamRequest();
        }
      }

      if (!response.ok) {
        if (isRecoverableChatStreamStatus(response.status)) {
          const fallbackResult = await sendMessageToConversation(
            conversationId,
            content
          );
          const completedMessage = fallbackResult.assistantMessage;

          if (completedMessage) {
            handlers.onMessageComplete?.({
              type: "message-complete",
              message: {
                id: String(completedMessage.id),
                role: "assistant",
                content: completedMessage.content,
                agentId: completedMessage.agentId ?? activeAgentId,
                createdAt:
                  completedMessage.createdAt instanceof Date
                    ? completedMessage.createdAt.toISOString()
                    : new Date(completedMessage.createdAt).toISOString(),
                metadata: completedMessage.metadata,
              },
            });
          }

          return completedMessage
            ? {
                id: String(completedMessage.id),
                role: "assistant" as const,
                content: completedMessage.content,
                agentId: completedMessage.agentId ?? activeAgentId,
                createdAt:
                  completedMessage.createdAt instanceof Date
                    ? completedMessage.createdAt.toISOString()
                    : new Date(completedMessage.createdAt).toISOString(),
                metadata: completedMessage.metadata,
              }
            : null;
        }

        throw new Error(`Streaming request failed with HTTP ${response.status}.`);
      }

      if (!response.body) {
        throw new Error("Streaming response did not include a readable body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedMessage:
        | Extract<ChatStreamEvent, { type: "message-complete" }>["message"]
        | null = null;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const parsed = parseChatStreamChunk(buffer);
        buffer = parsed.remainder;

        for (const event of parsed.events) {
          handlers.onEvent?.(event);

          if (event.type === "stage") {
            handlers.onStage?.(event);
            continue;
          }

          if (event.type === "text-delta") {
            handlers.onTextDelta?.(event);
            continue;
          }

          if (event.type === "message-complete") {
            completedMessage = event.message;
            handlers.onMessageComplete?.(event);
            continue;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }

        if (done) {
          break;
        }
      }

      await Promise.all([
        utils.chat.listConversations.invalidate(),
        utils.chat.getConversation.invalidate({ id: conversationId }),
      ]);

      return completedMessage;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Streaming the chat response failed unexpectedly.";
      setStreamError(message);
      throw error;
    } finally {
      setIsStreaming(false);
    }
  }

  async function removeConversation(sessionId: string) {
    const numericId = Number(sessionId);
    await runWithAuthSyncRetry("delete-conversation", () =>
      deleteConversationMutation.mutateAsync({ id: numericId })
    );

    if (activeConversationId === numericId) {
      clearChatStore();
      setSearchParams({});
      navigate("/chat");
      await utils.chat.getConversation.invalidate({ id: numericId });
    }

    await utils.chat.listConversations.invalidate();
  }

  const error =
    streamError ??
    createConversation.error ??
    sendMessageMutation.error ??
    deleteConversationMutation.error ??
    conversationsQuery.error ??
    conversationQuery.error ??
    null;

  return {
    sessions,
    messages,
    activeConversationId,
    isConversationLoading: conversationQuery.isLoading,
    isSending:
      isStreaming || sendMessageMutation.isPending || createConversation.isPending,
    error:
      typeof error === "string"
        ? error
        : error
          ? formatRuntimeError(error, "Chat")
          : null,
    selectConversation,
    startNewChat,
    sendMessage,
    streamMessage,
    removeConversation,
  };
}

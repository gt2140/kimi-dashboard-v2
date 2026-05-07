import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ensureBackendSession,
  trpc,
  useBackendSessionState,
} from "@/providers/trpc";
import { useChatStore } from "@/hooks/useStore";
import { resolveAuraRuntimeEndpoint } from "@/lib/aura-runtime";
import { formatRuntimeError } from "@/lib/app-errors";
import { logClientDebug } from "@/lib/debug";
import { buildAuthenticatedHeaders } from "@/lib/request-auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  createChatStreamWatchdog,
  isRecoverableChatStreamError,
  isRecoverableChatStreamStatus,
  parseChatStreamChunk,
  type ChatStreamEvent,
} from "@/lib/chat-stream";
import { mapConversationSummary, mapMessage } from "@/hooks/kimi-chat-mappers";
import { createPersistedCompletionReader } from "@/hooks/kimi-chat-recovery";
import type { Message } from "@/types";

const CHAT_STREAM_INACTIVITY_TIMEOUT_MS = 45_000;
const STREAM_RECOVERY_POLL_ATTEMPTS = 6;
const STREAM_RECOVERY_POLL_DELAY_MS = 750;
const CHAT_STREAM_FIRST_EVENT_TIMEOUT_MS = 15_000;

function mapCompletedAssistantMessage(message: {
  id: number | string;
  role?: "assistant";
  content: string;
  agentId: string | null;
  createdAt: Date | string;
  metadata?: Message["metadata"];
}) {
  return {
    id: String(message.id),
    role: "assistant" as const,
    content: message.content,
    agentId: message.agentId ?? "generalist",
    createdAt:
      message.createdAt instanceof Date
        ? message.createdAt.toISOString()
        : new Date(message.createdAt).toISOString(),
    metadata: message.metadata,
  };
}

export function useKimiChatData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const backendSession = useBackendSessionState();
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const calledAgentIds = useChatStore(state => state.calledAgentIds);
  const runtimeVersion = useChatStore(state => state.runtimeVersion);
  const medicalMode = useChatStore(state => state.medicalMode);
  const policyLevel = useChatStore(state => state.policyLevel);
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const hydrateConversation = useChatStore(state => state.hydrateConversation);
  const clearChatStore = useChatStore(state => state.clearChat);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const rawConversationId = searchParams.get("conversation");
  const activeConversationId = rawConversationId
    ? Number(rawConversationId)
    : null;
  const authedQueriesEnabled =
    !isSupabaseConfigured || backendSession.backendReady;

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
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();
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

    const synced = await ensureBackendSession();
    if (!synced) {
      throw new Error(
        "Your browser session exists, but the backend session is not ready yet.",
      );
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
      onEvent?: (event: ChatStreamEvent) => void;
      onStage?: (stage: Extract<ChatStreamEvent, { type: "stage" }>) => void;
      onTextDelta?: (
        event: Extract<ChatStreamEvent, { type: "text-delta" }>,
      ) => void;
      onMessageComplete?: (
        event: Extract<ChatStreamEvent, { type: "message-complete" }>,
      ) => void;
    } = {},
  ) {
    const conversationId = await ensureConversationId(content);
    const synced = await ensureBackendSession();

    if (!synced) {
      throw new Error(
        "Your browser session exists, but the backend session is not ready yet.",
      );
    }

    setStreamError(null);
    setIsStreaming(true);
    let streamStarted = false;
    let receivedAssistantText = false;
    let fallbackTriggered = false;
    let firstEventAt: number | null = null;
    let firstDeltaAt: number | null = null;
    const requestStartedAt = Date.now();
    const streamWatchdog = createChatStreamWatchdog(
      CHAT_STREAM_INACTIVITY_TIMEOUT_MS,
      "Kimi chat stream",
      {
        initialTimeoutMs: CHAT_STREAM_FIRST_EVENT_TIMEOUT_MS,
      },
    );

    const readPersistedCompletion = createPersistedCompletionReader({
      conversationId,
      userMessage: content,
      activeAgentId,
      pollAttempts: STREAM_RECOVERY_POLL_ATTEMPTS,
      pollDelayMs: STREAM_RECOVERY_POLL_DELAY_MS,
      invalidateConversation: args => utils.chat.getConversation.invalidate(args),
      fetchConversation: args => utils.chat.getConversation.fetch(args),
      onRecoveredMessage: message => {
        handlers.onMessageComplete?.({
          type: "message-complete",
          message,
        });
      },
    });

    async function recoverWithoutStream() {
      fallbackTriggered = true;
      logClientDebug("kimi.chat.fallback.start", {
        conversationId,
        elapsedMs: Date.now() - requestStartedAt,
        streamStarted,
        receivedAssistantText,
      });

      const recoveredMessage = await readPersistedCompletion();
      if (recoveredMessage) {
        return recoveredMessage;
      }

      const result = await sendMessageMutation.mutateAsync({
        conversationId,
        content,
        agentId: activeAgentId,
        calledAgentIds,
        runtimeVersion,
        medicalMode,
        policyLevel,
      });

      await Promise.all([
        utils.chat.listConversations.invalidate(),
        utils.chat.getConversation.invalidate({ id: conversationId }),
      ]);

      const assistantMessage = result.assistantMessage
        ? mapCompletedAssistantMessage(result.assistantMessage)
        : await readPersistedCompletion();

      if (!assistantMessage) {
        throw new Error(
          "Kimi chat completed without a persisted assistant message.",
        );
      }

      handlers.onMessageComplete?.({
        type: "message-complete",
        message: assistantMessage,
      });
      return assistantMessage;
    }

    try {
      async function openStream(forceSessionRefresh = false) {
        if (forceSessionRefresh) {
          const refreshed = await ensureBackendSession({ force: true });
          if (!refreshed) {
            throw new Error(
              "Your browser session exists, but the backend session is not ready yet.",
            );
          }
        }

        const headers = await buildAuthenticatedHeaders(readAccessToken, {
          "Content-Type": "application/json",
        });
        return fetch(
          resolveAuraRuntimeEndpoint({
            runtimeVersion,
            medicalMode,
            policyLevel,
          }),
          {
            method: "POST",
            credentials: "include",
            signal: streamWatchdog.signal,
            headers,
            body: JSON.stringify({
              conversationId,
              content,
              agentId: activeAgentId,
              calledAgentIds,
              runtimeVersion,
              medicalMode,
              policyLevel,
            }),
          },
        );
      }

      let response = await openStream();

      if (response.status === 401) {
        response = await openStream(true);
      }

      if (!response.ok) {
        if (isRecoverableChatStreamStatus(response.status)) {
          const recoveredMessage = await readPersistedCompletion();
          if (recoveredMessage) {
            return recoveredMessage;
          }
        }

        throw new Error(`Kimi chat failed with HTTP ${response.status}.`);
      }

      if (!response.body) {
        throw new Error("Kimi chat did not return a readable stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedMessage:
        | Extract<ChatStreamEvent, { type: "message-complete" }>["message"]
        | null = null;

      while (true) {
        const { done, value } = await reader.read();
        streamWatchdog.touch();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const parsed = parseChatStreamChunk(buffer);
        buffer = parsed.remainder;

        for (const event of parsed.events) {
          streamStarted = true;
          if (firstEventAt === null) {
            firstEventAt = Date.now();
            logClientDebug("kimi.chat.first-event", {
              conversationId,
              elapsedMs: firstEventAt - requestStartedAt,
              eventType: event.type,
            });
          }
          handlers.onEvent?.(event);

          if (event.type === "stage") {
            handlers.onStage?.(event);
            continue;
          }

          if (event.type === "text-delta") {
            receivedAssistantText = true;
            if (firstDeltaAt === null) {
              firstDeltaAt = Date.now();
              logClientDebug("kimi.chat.first-delta", {
                conversationId,
                elapsedMs: firstDeltaAt - requestStartedAt,
              });
            }
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

      logClientDebug("kimi.chat.stream.completed", {
        conversationId,
        elapsedMs: Date.now() - requestStartedAt,
        fallbackTriggered,
      });

      if (!completedMessage) {
        return recoverWithoutStream();
      }

      return completedMessage;
    } catch (error) {
      if (isRecoverableChatStreamError(error)) {
        logClientDebug("kimi.chat.stream.recoverable", {
          conversationId,
          elapsedMs: Date.now() - requestStartedAt,
          streamStarted,
          receivedAssistantText,
          fallbackTriggered,
          error: error instanceof Error ? error.message : "recoverable-error",
        });

        if (!receivedAssistantText) {
          return recoverWithoutStream();
        }
      }

      const message =
        error instanceof Error
          ? formatRuntimeError(error, "Kimi chat")
          : formatRuntimeError(
              new Error("Kimi streaming failed unexpectedly."),
              "Kimi chat",
            );
      setStreamError(message);
      throw error;
    } finally {
      streamWatchdog.cancel();
      setIsStreaming(false);
    }
  }

  async function removeConversation(sessionId: string) {
    const synced = await ensureBackendSession();
    if (!synced) {
      throw new Error(
        "Your browser session exists, but the backend session is not ready yet.",
      );
    }

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
      isStreaming || createConversation.isPending || sendMessageMutation.isPending,
    error:
      typeof error === "string"
        ? formatRuntimeError(new Error(error), "Kimi chat")
        : error
          ? formatRuntimeError(error, "Kimi chat")
          : null,
    selectConversation,
    startNewChat,
    streamMessage,
    removeConversation,
  };
}

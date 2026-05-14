import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ensureBackendSession,
  trpc,
  useBackendSessionState,
} from "@/providers/trpc";
import { useChatStore } from "@/hooks/useStore";
import { formatRuntimeError } from "@/lib/app-errors";
import { logClientDebug } from "@/lib/debug";
import { buildAuthenticatedHeaders } from "@/lib/request-auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  isRecoverableChatStreamError,
  isRecoverableChatStreamStatus,
  type ChatStreamEvent,
} from "@/lib/chat-stream";
import { resolveRuntimeModelSelection } from "@/lib/model-catalog";
import { mapConversationSummary, mapMessage } from "@/hooks/kimi-chat-mappers";
import { createPersistedCompletionReader } from "@/hooks/kimi-chat-recovery";

const STREAM_RECOVERY_POLL_ATTEMPTS = 6;
const STREAM_RECOVERY_POLL_DELAY_MS = 750;

export function useKimiChatData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const backendSession = useBackendSessionState();
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const selectedProviderSlug = useChatStore(state => state.selectedProviderSlug);
  const selectedModelName = useChatStore(state => state.selectedModelName);
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

    void ensureBackendSession().catch(() => null);

    const created = await createConversation.mutateAsync({
      agentId: nextAgentId,
      title: "New conversation",
    });
    navigate(`/kimi/chat?conversation=${created.id}`);
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
      onEvent?: (event: ChatStreamEvent) => void;
      onAck?: (event: Extract<ChatStreamEvent, { type: "ack" }>) => void;
      onStage?: (stage: Extract<ChatStreamEvent, { type: "stage" }>) => void;
      onTextDelta?: (
        event: Extract<ChatStreamEvent, { type: "text-delta" }>,
      ) => void;
      onMessageComplete?: (
        event: Extract<ChatStreamEvent, { type: "message-complete" }>,
      ) => void;
    } = {},
  ) {
    void ensureBackendSession().catch(() => null);

    const conversationId = await ensureConversationId(content);

    setStreamError(null);
    setIsStreaming(true);
    let streamStarted = false;
    const requestStartedAt = Date.now();
    const modelSelection = resolveRuntimeModelSelection(
      selectedProviderSlug,
      selectedModelName,
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

    async function recoverPersistedCompletion() {
      logClientDebug("kimi.chat.fallback.start", {
        conversationId,
        elapsedMs: Date.now() - requestStartedAt,
        streamStarted,
        recoveryMode: "persisted-completion-only",
      });

      return readPersistedCompletion();
    }

    try {
      async function sendJsonMessage(forceSessionRefresh = false) {
        if (forceSessionRefresh) {
          const refreshed = await ensureBackendSession({ force: true });
          if (!refreshed) {
            logClientDebug("kimi.chat.auth.retry-skipped", {
              conversationId,
              reason: "backend-session-refresh-unavailable",
            });
          }
        }

        const headers = await buildAuthenticatedHeaders(readAccessToken, {
          "Content-Type": "application/json",
        });
        return fetch("/api/chat/send", {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            conversationId,
            content,
            agentId: activeAgentId,
            ...modelSelection,
          }),
        });
      }

      handlers.onStage?.({
        type: "stage",
        stageId: "draft",
        label: "Writing Venice response",
      });

      let response = await sendJsonMessage();

      if (response.status === 401) {
        response = await sendJsonMessage(true);
      }

      const payload = (await response.json().catch(() => null)) as {
        message?: Extract<ChatStreamEvent, { type: "message-complete" }>["message"];
        error?:
          | string
          | {
              message?: string;
              category?: string;
              traceId?: string;
            };
      } | null;

      if (!response.ok) {
        let responseMessage = `Aura chat failed with HTTP ${response.status}.`;
        let category: string | undefined;
        let traceId: string | undefined;

        if (typeof payload?.error === "string" && payload.error.trim()) {
          responseMessage = payload.error.trim();
        } else if (payload?.error && typeof payload.error === "object") {
          responseMessage = payload.error.message?.trim() || responseMessage;
          category = payload.error.category;
          traceId = payload.error.traceId;
        }

        if (isRecoverableChatStreamStatus(response.status)) {
          const recoveredMessage = await recoverPersistedCompletion();
          if (recoveredMessage) {
            return recoveredMessage;
          }
        }

        const httpError = new Error(responseMessage) as Error & {
          category?: string;
          traceId?: string;
        };
        httpError.category =
          category ||
          (response.status === 401
            ? "auth"
            : response.status >= 500
              ? "backend-timeout"
              : "transport");
        httpError.traceId = traceId;
        throw httpError;
      }

      const completedMessage = payload?.message ?? null;

      await Promise.all([
        utils.chat.listConversations.invalidate(),
        utils.chat.getConversation.invalidate({ id: conversationId }),
      ]);

      logClientDebug("kimi.chat.stream.completed", {
        conversationId,
        elapsedMs: Date.now() - requestStartedAt,
        transport: "json",
      });

      if (!completedMessage) {
        const recoveredMessage = await recoverPersistedCompletion();
        if (recoveredMessage) {
          return recoveredMessage;
        }

        throw new Error(
          "Aura chat completed without a terminal assistant message.",
        );
      }

      streamStarted = true;
      handlers.onMessageComplete?.({
        type: "message-complete",
        message: completedMessage,
      });
      return completedMessage;
    } catch (error) {
      if (isRecoverableChatStreamError(error)) {
        logClientDebug("kimi.chat.stream.recoverable", {
          conversationId,
          elapsedMs: Date.now() - requestStartedAt,
          streamStarted,
          error: error instanceof Error ? error.message : "recoverable-error",
        });

        const recoveredMessage = await recoverPersistedCompletion();
        if (recoveredMessage) {
          return recoveredMessage;
        }
      }

      const message =
        error instanceof Error
          ? formatRuntimeError(error, "Aura chat")
          : formatRuntimeError(
              new Error("Aura streaming failed unexpectedly."),
              "Aura chat",
            );
      setStreamError(message);
      throw error;
    } finally {
      setIsStreaming(false);
    }
  }

  async function removeConversation(sessionId: string) {
    void ensureBackendSession().catch(() => null);

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
          ? formatRuntimeError(error, "Aura chat")
          : null,
    selectConversation,
    startNewChat,
    streamMessage,
    removeConversation,
  };
}

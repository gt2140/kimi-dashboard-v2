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
  createMalformedStreamError,
  createChatStreamWatchdog,
  isRecoverableChatStreamError,
  isRecoverableChatStreamStatus,
  parseChatStreamChunk,
  readChatStreamResponseMetadata,
  type ChatStreamEvent,
} from "@/lib/chat-stream";
import { resolveRuntimeModelSelection } from "@/lib/model-catalog";
import { mapConversationSummary, mapMessage } from "@/hooks/kimi-chat-mappers";
import { createPersistedCompletionReader } from "@/hooks/kimi-chat-recovery";

const CHAT_STREAM_INACTIVITY_TIMEOUT_MS = 45_000;
const STREAM_RECOVERY_POLL_ATTEMPTS = 6;
const STREAM_RECOVERY_POLL_DELAY_MS = 750;
const CHAT_STREAM_FIRST_EVENT_TIMEOUT_MS = 15_000;

export function useKimiChatData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const backendSession = useBackendSessionState();
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const calledAgentIds = useChatStore(state => state.calledAgentIds);
  const runtimeVersion = useChatStore(state => state.runtimeVersion);
  const medicalMode = useChatStore(state => state.medicalMode);
  const policyLevel = useChatStore(state => state.policyLevel);
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
    let firstEventAt: number | null = null;
    let firstDeltaAt: number | null = null;
    const requestStartedAt = Date.now();
    const modelSelection = resolveRuntimeModelSelection(
      selectedProviderSlug,
      selectedModelName,
    );
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
      async function openStream(forceSessionRefresh = false) {
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
              ...modelSelection,
            }),
          },
        );
      }

      let response = await openStream();

      if (response.status === 401) {
        response = await openStream(true);
      }

      if (!response.ok) {
        let responseMessage = `Kimi chat failed with HTTP ${response.status}.`;
        try {
          const payload = (await response.clone().json()) as {
            error?: string;
            message?: string;
            traceId?: string;
          };
          responseMessage =
            payload.error?.trim() ||
            payload.message?.trim() ||
            responseMessage;
        } catch {
          // Fall back to the HTTP status message when the response is not JSON.
        }

        if (isRecoverableChatStreamStatus(response.status)) {
          const recoveredMessage = await recoverPersistedCompletion();
          if (recoveredMessage) {
            return recoveredMessage;
          }
        }

        const httpError = new Error(responseMessage) as Error & {
          category?: string;
        };
        httpError.category =
          response.status === 401
            ? "auth"
            : response.status >= 500
              ? "backend-timeout"
              : "transport";
        throw httpError;
      }

      if (!response.body) {
        throw new Error("Kimi chat did not return a readable stream.");
      }

      const responseMetadata = readChatStreamResponseMetadata(response);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rawBodyPreview = "";
      let completedMessage:
        | Extract<ChatStreamEvent, { type: "message-complete" }>["message"]
        | null = null;

      while (true) {
        const { done, value } = await reader.read();
        streamWatchdog.touch();
        const decoded = decoder.decode(value ?? new Uint8Array(), {
          stream: !done,
        });
        buffer += decoded;
        if (rawBodyPreview.length < 300) {
          rawBodyPreview = `${rawBodyPreview}${decoded}`.slice(0, 300);
        }

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

          if (event.type === "ack") {
            handlers.onAck?.(event);
            logClientDebug("kimi.chat.ack", {
              conversationId,
              traceId: event.traceId,
              elapsedMs: Date.now() - requestStartedAt,
            });
            continue;
          }

          if (event.type === "stage") {
            handlers.onStage?.(event);
            continue;
          }

          if (event.type === "text-delta") {
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
            const structuredError = new Error(event.message) as Error & {
              category?: string;
              traceId?: string;
            };
            structuredError.category = event.category;
            structuredError.traceId = event.traceId;
            throw structuredError;
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
      });

      if (!streamStarted && (buffer.trim() || rawBodyPreview.trim())) {
        throw createMalformedStreamError({
          bodyPreview: buffer.trim() || rawBodyPreview,
          status: responseMetadata.status,
          contentType: responseMetadata.contentType,
          traceId: responseMetadata.traceId,
        });
      }

      if (!completedMessage) {
        const recoveredMessage = await recoverPersistedCompletion();
        if (recoveredMessage) {
          return recoveredMessage;
        }

        throw new Error(
          "Kimi chat completed without a terminal assistant message.",
        );
      }

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

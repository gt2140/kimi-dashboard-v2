import { logServerDebug, logServerError } from "../lib/debug.js";

export type ChatTurnFailureKind =
  | "auth-session"
  | "context-load"
  | "provider-plan"
  | "provider-stream"
  | "provider-response"
  | "stream-parse"
  | "assistant-persist"
  | "message-context"
  | "run-finalize"
  | "unknown";

export function createChatTurnTrace(input: {
  requestId: string;
  route: string;
  conversationId: number;
  userId: number;
  agentId: string;
  runtimeVersion?: "classic" | "aura-medical-v1";
  medicalMode?: "personal-health" | "research";
}) {
  const startedAt = Date.now();
  let lastStageId: string | null = null;

  function buildDetails(extra?: Record<string, unknown>) {
    return {
      requestId: input.requestId,
      route: input.route,
      conversationId: input.conversationId,
      userId: input.userId,
      agentId: input.agentId,
      runtimeVersion: input.runtimeVersion ?? "classic",
      medicalMode: input.medicalMode ?? "personal-health",
      lastStageId,
      elapsedMs: Date.now() - startedAt,
      ...(extra ?? {}),
    };
  }

  return {
    startedAt,
    markStage(stageId: string, label: string) {
      lastStageId = stageId;
      logServerDebug("chat.turn.stage", buildDetails({ stageId, label }));
    },
    debug(event: string, extra?: Record<string, unknown>) {
      logServerDebug(`chat.turn.${event}`, buildDetails(extra));
    },
    fail(kind: ChatTurnFailureKind, error: unknown, extra?: Record<string, unknown>) {
      logServerError("chat.turn.failed", error, buildDetails({ kind, ...(extra ?? {}) }));
    },
  };
}

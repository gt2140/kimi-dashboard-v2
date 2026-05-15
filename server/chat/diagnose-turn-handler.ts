import { eq } from "drizzle-orm";
import { messages } from "../../db/schema.js";
import { env } from "../lib/env.js";
import { classifyApiError } from "../lib/api-errors.js";
import { getDb } from "../queries/connection.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { ModelGatewayService } from "../services/model-gateway.js";
import { loadRecentConversationMessages } from "../services/venice-chat-runtime.js";
import { authenticateRequest as defaultAuthenticateRequest } from "../trpc/auth.js";
import { chatSendMessageInputSchema } from "../trpc/chat-router.js";

type DiagnosticStageId =
  | "auth"
  | "request-validation"
  | "conversation-owner"
  | "recent-messages"
  | "venice-preflight"
  | "venice-generation"
  | "db-write-capability"
  | "client-contract";

type DiagnosticStage = {
  id: DiagnosticStageId;
  ok: boolean;
  durationMs: number;
  message?: string;
  category?: ReturnType<typeof classifyApiError>["category"] | "ready";
  details?: Record<string, unknown>;
};

type DiagnosticDependencies = {
  authenticateRequest?: typeof defaultAuthenticateRequest;
  requireConversationOwner?: ConversationRepository["requireConversationOwner"];
  loadRecentMessages?: typeof loadRecentConversationMessages;
  diagnoseVenice?: ModelGatewayService["diagnoseVenice"];
  generateText?: ModelGatewayService["generateText"];
  checkDbWriteCapability?: (conversationId: number) => Promise<void>;
  getDeploymentHint?: () => {
    nodeEnv: string;
    defaultModel: string | null;
    hasVeniceKey: boolean;
  };
  now?: () => number;
  traceId?: () => string;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...(init ?? {}),
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

function defaultDeploymentHint() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    defaultModel: env.veniceModel || null,
    hasVeniceKey: Boolean(env.veniceApiKey),
  };
}

async function defaultCheckDbWriteCapability(conversationId: number) {
  await getDb()
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .limit(1);
}

function readStageError(error: unknown) {
  const classified = classifyApiError(error);
  return {
    message: classified.message,
    category: classified.category,
  };
}

export async function handleDiagnoseTurnRequest(
  request: Request,
  dependencies: DiagnosticDependencies = {}
) {
  const now = dependencies.now ?? Date.now;
  const traceId = dependencies.traceId?.() ?? globalThis.crypto.randomUUID().slice(0, 8);
  const stages: DiagnosticStage[] = [];
  const deploymentHint =
    dependencies.getDeploymentHint?.() ?? defaultDeploymentHint();

  async function runStage<T>(
    id: DiagnosticStageId,
    action: () => Promise<T>,
    details?: (result: T) => Record<string, unknown> | undefined
  ) {
    const startedAt = now();
    try {
      const result = await action();
      stages.push({
        id,
        ok: true,
        durationMs: Math.max(0, now() - startedAt),
        ...(details ? { details: details(result) } : {}),
      });
      return { ok: true as const, result };
    } catch (error) {
      const failure = readStageError(error);
      stages.push({
        id,
        ok: false,
        durationMs: Math.max(0, now() - startedAt),
        message: failure.message,
        category: failure.category,
      });
      return { ok: false as const, failure };
    }
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        traceId,
        deploymentHint,
        failedStage: "request-validation",
        stages: [
          {
            id: "request-validation",
            ok: false,
            durationMs: 0,
            message: "Method not allowed.",
            category: "transport",
          },
        ],
      },
      { status: 405, headers: { "x-trace-id": traceId } }
    );
  }

  const authenticateRequest =
    dependencies.authenticateRequest ?? defaultAuthenticateRequest;
  const auth = await runStage("auth", () => authenticateRequest(request.headers));
  if (!auth.ok) {
    return jsonResponse(
      {
        ok: false,
        traceId,
        deploymentHint,
        failedStage: "auth",
        stages,
      },
      { status: 401, headers: { "x-trace-id": traceId } }
    );
  }

  const body = await request.json().catch(() => null);
  const validationStartedAt = now();
  const parsed = chatSendMessageInputSchema.safeParse(body);
  if (!parsed.success) {
    stages.push({
      id: "request-validation",
      ok: false,
      durationMs: Math.max(0, now() - validationStartedAt),
      message: "Invalid request body.",
      category: "transport",
      details: parsed.error.flatten(),
    });
    return jsonResponse(
      {
        ok: false,
        traceId,
        deploymentHint,
        failedStage: "request-validation",
        stages,
      },
      { status: 400, headers: { "x-trace-id": traceId } }
    );
  }

  stages.push({
    id: "request-validation",
    ok: true,
    durationMs: Math.max(0, now() - validationStartedAt),
    details: {
      hasRequestedModelName: Boolean(parsed.data.requestedModelName),
      contentLength: parsed.data.content.length,
    },
  });

  const repository = new ConversationRepository();
  const requireConversationOwner =
    dependencies.requireConversationOwner ??
    repository.requireConversationOwner.bind(repository);
  const owner = await runStage(
    "conversation-owner",
    () => requireConversationOwner(parsed.data.conversationId, auth.result.id),
    conversation => ({
      conversationId: conversation.id,
      hasSummary: Boolean(conversation.summary?.trim()),
    })
  );
  if (!owner.ok) {
    return jsonResponse(
      { ok: false, traceId, deploymentHint, failedStage: "conversation-owner", stages },
      { status: 200, headers: { "x-trace-id": traceId } }
    );
  }

  const loadRecentMessages =
    dependencies.loadRecentMessages ?? loadRecentConversationMessages;
  const recent = await runStage(
    "recent-messages",
    () =>
      loadRecentMessages({
        conversationId: parsed.data.conversationId,
        limit: 6,
      }),
    messages => ({
      count: messages.length,
      roles: messages.map(message => message.role),
    })
  );
  if (!recent.ok) {
    return jsonResponse(
      { ok: false, traceId, deploymentHint, failedStage: "recent-messages", stages },
      { status: 200, headers: { "x-trace-id": traceId } }
    );
  }

  const gateway = new ModelGatewayService();
  const diagnoseVenice =
    dependencies.diagnoseVenice ?? gateway.diagnoseVenice.bind(gateway);
  const preflight = await runStage(
    "venice-preflight",
    () => diagnoseVenice({ modelName: parsed.data.requestedModelName }),
    provider => ({
      providerSlug: provider.providerSlug,
      modelName: provider.modelName,
      providerCategory: provider.category,
      providerStatus: provider.status ?? null,
    })
  );
  if (!preflight.ok || !preflight.result.ok) {
    if (preflight.ok) {
      stages[stages.length - 1] = {
        ...stages[stages.length - 1],
        ok: false,
        message: preflight.result.message,
        category: "provider-error",
      };
    }
    return jsonResponse(
      { ok: false, traceId, deploymentHint, failedStage: "venice-preflight", stages },
      { status: 200, headers: { "x-trace-id": traceId } }
    );
  }

  const generateText =
    dependencies.generateText ?? gateway.generateText.bind(gateway);
  const generation = await runStage(
    "venice-generation",
    () =>
      generateText({
        providerSlug: "venice",
        modelName: parsed.data.requestedModelName,
        messages: [{ role: "user", content: "Reply with OK." }],
      }),
    result => ({
      providerSlug: result.providerSlug,
      modelName: result.modelName,
      outputLength: result.text.length,
    })
  );
  if (!generation.ok) {
    return jsonResponse(
      { ok: false, traceId, deploymentHint, failedStage: "venice-generation", stages },
      { status: 200, headers: { "x-trace-id": traceId } }
    );
  }

  const checkDbWriteCapability =
    dependencies.checkDbWriteCapability ?? defaultCheckDbWriteCapability;
  const dbWrite = await runStage("db-write-capability", () =>
    checkDbWriteCapability(parsed.data.conversationId)
  );
  if (!dbWrite.ok) {
    return jsonResponse(
      { ok: false, traceId, deploymentHint, failedStage: "db-write-capability", stages },
      { status: 200, headers: { "x-trace-id": traceId } }
    );
  }

  stages.push({
    id: "client-contract",
    ok: true,
    durationMs: 0,
    details: {
      endpoint: "/api/chat/send",
      expectedTransport: "json",
      requestedModelName: parsed.data.requestedModelName ?? null,
    },
  });

  return jsonResponse(
    {
      ok: true,
      traceId,
      deploymentHint,
      stages,
    },
    { status: 200, headers: { "x-trace-id": traceId } }
  );
}

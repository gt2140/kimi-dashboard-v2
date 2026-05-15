import { classifyApiError } from "../lib/api-errors.js";
import { auraChatConversationTurnRuntime } from "../services/venice-chat-runtime.js";
import type { ConversationTurnRuntime } from "../services/conversation-turn-runtime.js";
import { ModelGatewayService } from "../services/model-gateway.js";
import { authenticateRequest as defaultAuthenticateRequest } from "../trpc/auth.js";
import { chatSendMessageInputSchema } from "../trpc/chat-router.js";

type SimpleChatHandlerDependencies = {
  authenticateRequest?: typeof defaultAuthenticateRequest;
  runtime?: ConversationTurnRuntime;
  diagnoseProvider?: (input?: { modelName?: string | null }) => Promise<
    Awaited<ReturnType<ModelGatewayService["diagnoseVenice"]>>
  >;
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

function statusForCategory(category: ReturnType<typeof classifyApiError>["category"]) {
  return category === "auth" ? 401 : 500;
}

async function enrichProviderError(
  classified: ReturnType<typeof classifyApiError>,
  dependencies: SimpleChatHandlerDependencies,
  input?: { modelName?: string | null }
) {
  let message = classified.message;
  let provider:
    | Awaited<ReturnType<ModelGatewayService["diagnoseVenice"]>>
    | undefined;

  if (classified.category === "provider-error") {
    const diagnoseProvider =
      dependencies.diagnoseProvider ??
        (input => new ModelGatewayService().diagnoseVenice(input));
    provider = await diagnoseProvider(input).catch(() => undefined);
    if (provider && !provider.ok) {
      message = provider.message;
    } else {
      provider = undefined;
    }
  }

  return { message, provider };
}

export async function handleSimpleChatRequest(
  request: Request,
  dependencies: SimpleChatHandlerDependencies = {}
) {
  const traceId = globalThis.crypto.randomUUID().slice(0, 8);

  if (request.method !== "POST") {
    return jsonResponse(
      {
        error: {
          message: "Method not allowed.",
          category: "transport",
          traceId,
        },
      },
      { status: 405, headers: { "x-trace-id": traceId } }
    );
  }

  const authenticateRequest =
    dependencies.authenticateRequest ?? defaultAuthenticateRequest;
  const runtime = dependencies.runtime ?? auraChatConversationTurnRuntime;

  let user: Awaited<ReturnType<typeof defaultAuthenticateRequest>>;
  try {
    user = await authenticateRequest(request.headers);
  } catch (error) {
    const classified = classifyApiError(error);
    return jsonResponse(
      {
        error: {
          message: classified.message,
          category: classified.category,
          traceId,
        },
      },
      {
        status: 401,
        headers: { "x-trace-id": traceId },
      }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = chatSendMessageInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: {
          message: "Invalid request body.",
          category: "transport",
          traceId,
          details: parsed.error.flatten(),
        },
      },
      { status: 400, headers: { "x-trace-id": traceId } }
    );
  }

  const diagnoseProvider =
    dependencies.diagnoseProvider ??
    (input => new ModelGatewayService().diagnoseVenice(input));
  const providerReadiness = await diagnoseProvider({
    modelName: parsed.data.requestedModelName,
  }).catch(() => null);
  if (providerReadiness && !providerReadiness.ok) {
    return jsonResponse(
      {
        error: {
          message: providerReadiness.message,
          category: "provider-error",
          traceId,
          provider: providerReadiness,
        },
      },
      {
        status: 503,
        headers: { "x-trace-id": traceId },
      }
    );
  }

  try {
    const result = await runtime.executeTurn({
      userId: user.id,
      conversationId: parsed.data.conversationId,
      content: parsed.data.content,
      agentId: parsed.data.agentId,
      requestedModelName: parsed.data.requestedModelName,
      stream: false,
    });

    return jsonResponse(
      {
        message: {
          id: String(result.assistantMessage.id),
          role: "assistant",
          content: result.assistantMessage.content,
          agentId: result.assistantMessage.agentId,
          createdAt: result.assistantMessage.createdAt.toISOString(),
          metadata: result.assistantMessage.metadata,
        },
      },
      {
        status: 200,
        headers: { "x-trace-id": traceId },
      }
    );
  } catch (error) {
    const classified = classifyApiError(error);
    const enriched = await enrichProviderError(classified, dependencies, {
      modelName: parsed.data.requestedModelName,
    });
    return jsonResponse(
      {
        error: {
          message: enriched.message,
          category: classified.category,
          traceId,
          provider: enriched.provider,
        },
      },
      {
        status: statusForCategory(classified.category),
        headers: { "x-trace-id": traceId },
      }
    );
  }
}

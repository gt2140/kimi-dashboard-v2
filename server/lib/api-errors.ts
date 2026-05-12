export type ApiErrorCategory =
  | "auth"
  | "transport"
  | "backend-timeout"
  | "provider-timeout"
  | "provider-error"
  | "db-error"
  | "context-error";

export type ClassifiedApiError = {
  message: string;
  category: ApiErrorCategory;
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "An error occurred";
}

export function classifyApiError(error: unknown): ClassifiedApiError {
  const message = readErrorMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("unauthorized") ||
    normalized.includes("invalid authentication token") ||
    normalized.includes("forbidden") ||
    normalized.includes("authentication required")
  ) {
    return { message, category: "auth" };
  }

  if (
    normalized.includes("primary response generation timed out") ||
    normalized.includes("openai stream timed out") ||
    normalized.includes("openai request timed out") ||
    normalized.includes("kimi request timed out") ||
    normalized.includes("provider") && normalized.includes("timed out")
  ) {
    return { message, category: "provider-timeout" };
  }

  if (
    normalized.includes("database") ||
    normalized.includes("relation") ||
    normalized.includes("column") && normalized.includes("does not exist") ||
    normalized.includes("duplicate key") ||
    normalized.includes("max clients reached")
  ) {
    return { message, category: "db-error" };
  }

  if (
    normalized.includes("conversation turn setup timed out") ||
    normalized.includes("context-load") ||
    normalized.includes("loading chat context") ||
    normalized.includes("memory and aura context")
  ) {
    return { message, category: "context-error" };
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("aborted") ||
    normalized.includes("bodystreambuffer") ||
    normalized.includes("body") && normalized.includes("stream")
  ) {
    return { message, category: "transport" };
  }

  if (
    normalized.includes("openai") ||
    normalized.includes("kimi request failed") ||
    normalized.includes("model provider") ||
    normalized.includes("upstream")
  ) {
    return { message, category: "provider-error" };
  }

  return { message, category: "backend-timeout" };
}

export function toJsonErrorResponse(
  error: unknown,
  status = 500,
  traceId = globalThis.crypto.randomUUID().slice(0, 8),
) {
  const classified = classifyApiError(error);

  return Response.json(
    {
      error: {
        message: classified.message,
        category: classified.category,
        traceId,
      },
    },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-trace-id": traceId,
      },
    },
  );
}

export function toNdjsonErrorEvent(
  error: unknown,
  traceId = globalThis.crypto.randomUUID().slice(0, 8),
) {
  const classified = classifyApiError(error);

  return `${JSON.stringify({
    type: "error",
    message: classified.message,
    category: classified.category,
    traceId,
  })}\n`;
}

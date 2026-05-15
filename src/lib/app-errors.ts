type ErrorWithData = {
  message?: string;
  category?: string;
  traceId?: string;
  provider?: {
    ok?: boolean;
    message?: string;
  };
  data?: {
    code?: string;
  };
};

function readError(input: unknown): ErrorWithData {
  if (input && typeof input === "object") {
    return input as ErrorWithData;
  }

  return {};
}

export function formatRuntimeError(input: unknown, fallbackLabel = "Request") {
  const error = readError(input);
  const message = error.message?.trim() || `${fallbackLabel} failed.`;
  const normalized = message.toLowerCase();
  const code = error.data?.code;
  const traceSuffix = error.traceId ? ` (trace ${error.traceId})` : "";

  switch (error.category) {
    case "auth":
      return `Auth error: sign in again to continue.${traceSuffix}`;
    case "transport":
      return `Transport error: the chat connection was interrupted. Try again.${traceSuffix}`;
    case "backend-timeout":
      return `Backend timeout: the chat backend took too long to finish. Check the deployed API, database connectivity, or upstream provider.${traceSuffix}`;
    case "provider-timeout":
      return `Provider timeout: the model provider took too long to answer. Retry in a moment.${traceSuffix}`;
    case "provider-error":
      if (error.provider?.ok !== true && error.provider?.message?.trim()) {
        return `Provider error: ${error.provider.message.trim()}${traceSuffix}`;
      }
      if (normalized.startsWith("venice ")) {
        return `Provider error: ${message}${traceSuffix}`;
      }
      return `Provider error: the model provider failed to complete the chat turn. Check the API logs for upstream details.${traceSuffix}`;
    case "db-error":
      return `Database error: ${message}${traceSuffix}`;
    case "context-error":
      return `Context error: ${message}${traceSuffix}`;
    default:
      break;
  }

  if (code === "UNAUTHORIZED" || normalized.includes("unauth")) {
    return `Auth error: sign in again to continue.${traceSuffix}`;
  }

  if (normalized.includes("authentication provider took too long")) {
    return `Auth error: Google sign-in took too long to finish. Try again.${traceSuffix}`;
  }

  if (normalized.includes("backend session is not ready yet")) {
    return `Auth error: sign-in is still finishing in the background. Try again in a moment.${traceSuffix}`;
  }

  if (
    normalized.includes("this operation was aborted") ||
    normalized.includes("bodystreambuffer was aborted") ||
    normalized.includes("was aborted") ||
    normalized.includes("aborterror") ||
    normalized.includes("request was interrupted")
  ) {
    return `Network error: the request was interrupted. Try again.${traceSuffix}`;
  }

  if (
    normalized.includes("chat stream timed out") ||
    normalized.includes("aura chat stream timed out")
  ) {
    return `Backend timeout: the chat backend took too long to start streaming. Check the deployed API, auth, database connectivity, or cold start logs.${traceSuffix}`;
  }

  if (
    normalized.includes("chat turn timed out") ||
    normalized.includes("kimi chat turn timed out") ||
    normalized.includes("aura medical chat turn timed out") ||
    normalized.includes("kimi request timed out")
  ) {
    return `Runtime error: the chat backend timed out before finishing. Check the deployed API, database connectivity, or model provider.${traceSuffix}`;
  }

  if (
    normalized.includes("kimi request failed") ||
    normalized.includes("did not return a readable stream")
  ) {
    return `Runtime error: the model provider failed to complete the chat turn. Check the local API logs for provider or stream details.${traceSuffix}`;
  }

  if (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("timed out")
  ) {
    return `Network error: check the local API connection and try again.${traceSuffix}`;
  }

  if (
    normalized.includes("setup error") ||
    normalized.includes("precondition") ||
    normalized.includes("backend setup")
  ) {
    return `Setup error: ${message}${traceSuffix}`;
  }

  if (
    normalized.includes("emaxconnsession") ||
    normalized.includes("max clients reached in session mode")
  ) {
    return `Setup error: Supabase connection pool is exhausted. Confirm DATABASE_URL uses the pooled 6543 URL and restart the backend.${traceSuffix}`;
  }

  if (
    (normalized.includes("column") && normalized.includes("does not exist")) ||
    (normalized.includes("relation") && normalized.includes("does not exist")) ||
    normalized.includes("conversational schema is not fully installed")
  ) {
    return `Setup error: database schema is out of date. Re-run app/supabase/init.sql in Supabase and restart the backend.${traceSuffix}`;
  }

  if (
    normalized.includes("database") ||
    normalized.includes("relation") ||
    normalized.includes("duplicate key") ||
    normalized.includes("conversation not found") ||
    normalized.includes("file not found")
  ) {
    return `Database error: ${message}${traceSuffix}`;
  }

  if (
    normalized.includes("procedure") ||
    normalized.includes("router") ||
    normalized.includes("not found")
  ) {
    return `Router error: ${message}${traceSuffix}`;
  }

  return `${fallbackLabel} error: ${message}${traceSuffix}`;
}

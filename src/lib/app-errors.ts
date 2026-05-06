type ErrorWithData = {
  message?: string;
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

  if (code === "UNAUTHORIZED" || normalized.includes("unauth")) {
    return "Auth error: sign in again to continue.";
  }

  if (normalized.includes("authentication provider took too long")) {
    return "Auth error: Google sign-in took too long to finish. Try again.";
  }

  if (normalized.includes("backend session is not ready yet")) {
    return "Auth error: sign-in is still finishing in the background. Try again in a moment.";
  }

  if (
    normalized.includes("this operation was aborted") ||
    normalized.includes("bodystreambuffer was aborted") ||
    normalized.includes("was aborted") ||
    normalized.includes("aborterror") ||
    normalized.includes("request was interrupted")
  ) {
    return "Network error: the request was interrupted. Try again.";
  }

  if (
    normalized.includes("chat turn timed out") ||
    normalized.includes("kimi chat turn timed out") ||
    normalized.includes("aura medical chat turn timed out")
  ) {
    return "Runtime error: the chat backend timed out before finishing. Check the deployed API, database connectivity, or model provider.";
  }

  if (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("timed out")
  ) {
    return "Network error: check the local API connection and try again.";
  }

  if (
    normalized.includes("setup error") ||
    normalized.includes("precondition") ||
    normalized.includes("backend setup")
  ) {
    return `Setup error: ${message}`;
  }

  if (
    normalized.includes("emaxconnsession") ||
    normalized.includes("max clients reached in session mode")
  ) {
    return "Setup error: Supabase connection pool is exhausted. Confirm DATABASE_URL uses the pooled 6543 URL and restart the backend.";
  }

  if (
    (normalized.includes("column") && normalized.includes("does not exist")) ||
    (normalized.includes("relation") && normalized.includes("does not exist")) ||
    normalized.includes("conversational schema is not fully installed")
  ) {
    return "Setup error: database schema is out of date. Re-run app/supabase/init.sql in Supabase and restart the backend.";
  }

  if (
    normalized.includes("database") ||
    normalized.includes("relation") ||
    normalized.includes("duplicate key") ||
    normalized.includes("conversation not found") ||
    normalized.includes("file not found")
  ) {
    return `Database error: ${message}`;
  }

  if (
    normalized.includes("procedure") ||
    normalized.includes("router") ||
    normalized.includes("not found")
  ) {
    return `Router error: ${message}`;
  }

  return `${fallbackLabel} error: ${message}`;
}

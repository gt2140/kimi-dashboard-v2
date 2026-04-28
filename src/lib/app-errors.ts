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

  if (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("failed to fetch")
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

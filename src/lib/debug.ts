const PREFIX = "[aura-debug]";

export function logClientDebug(event: string, details?: unknown) {
  console.info(`${PREFIX} ${event}`, details ?? "");
}

export function logClientError(
  event: string,
  error: unknown,
  details?: unknown
) {
  console.error(`${PREFIX} ${event}`, {
    error,
    details,
  });
}

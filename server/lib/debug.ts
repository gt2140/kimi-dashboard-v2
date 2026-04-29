const PREFIX = "[aura-api]";

export function logServerDebug(event: string, details?: unknown) {
  console.info(`${PREFIX} ${event}`, details ?? "");
}

export function logServerError(
  event: string,
  error: unknown,
  details?: unknown
) {
  console.error(`${PREFIX} ${event}`, {
    error,
    details,
  });
}

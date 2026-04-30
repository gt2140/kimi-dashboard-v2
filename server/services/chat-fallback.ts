type OperationalFallbackNoteInput = {
  operationalFailureReason: string | null;
  fallbackReplyNote: string | null;
};

function normalizeMessage(message: string) {
  return message.toLowerCase();
}

export function extractOperationalFailureReason(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.trim();
  const normalized = normalizeMessage(message);

  if (
    normalized.includes("exceeded your current quota") ||
    normalized.includes("billing details")
  ) {
    return "OpenAI no pudo responder porque la cuota del proveedor esta agotada.";
  }

  if (normalized.includes("rate limit")) {
    return "OpenAI no pudo responder por rate limit o saturacion temporal.";
  }

  if (normalized.includes("timed out")) {
    return "OpenAI tardo demasiado en responder para este turno.";
  }

  if (normalized.includes("api key is missing")) {
    return "OpenAI no esta configurado correctamente en el backend.";
  }

  return message || null;
}

export function buildOperationalFallbackNote(
  input: OperationalFallbackNoteInput
) {
  if (input.operationalFailureReason) {
    return `${input.operationalFailureReason} Te dejo una respuesta limitada para no cortar el chat.`;
  }

  return input.fallbackReplyNote;
}

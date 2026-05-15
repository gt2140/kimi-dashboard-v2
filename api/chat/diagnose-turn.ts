import { handleDiagnoseTurnRequest } from "../../server/chat/diagnose-turn-handler.js";

type NodeRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type NodeResponseLike = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
  setHeader?: (name: string, value: string) => void;
};

function toHeaders(headers: NodeRequestLike["headers"]) {
  const output = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      output.set(name, value.join(", "));
      continue;
    }

    if (typeof value === "string") {
      output.set(name, value);
    }
  }

  return output;
}

function toRequest(req: NodeRequestLike) {
  return new Request("https://aura.local/api/chat/diagnose-turn", {
    method: req.method ?? "GET",
    headers: toHeaders(req.headers),
    body:
      req.method === "POST"
        ? JSON.stringify(req.body ?? {})
        : undefined,
  });
}

export default async function handler(
  request: NodeRequestLike,
  response: NodeResponseLike
) {
  const result = await handleDiagnoseTurnRequest(toRequest(request));
  response.setHeader?.("cache-control", "no-store");
  const traceId = result.headers.get("x-trace-id");
  if (traceId) {
    response.setHeader?.("x-trace-id", traceId);
  }
  response.status(result.status).json(await result.json());
}

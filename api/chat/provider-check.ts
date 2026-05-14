import { handleProviderCheckRequest } from "../../server/chat/provider-check-handler.js";

type NodeRequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
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
  return new Request("https://aura.local/api/chat/provider-check", {
    method: req.method ?? "GET",
    headers: toHeaders(req.headers),
  });
}

export default async function handler(
  request: NodeRequestLike,
  response: NodeResponseLike
) {
  const result = await handleProviderCheckRequest(toRequest(request));
  response.setHeader?.("cache-control", "no-store");
  response.status(result.status).json(await result.json());
}

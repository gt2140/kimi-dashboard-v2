import { env } from "../lib/env.js";

type ToolCall = {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
};

type ToolDefinition = Record<string, unknown>;

const toolCache = new Map<string, { fetchedAt: number; tools: ToolDefinition[] }>();
const CACHE_TTL_MS = 60_000;

function normalizeFormulaUri(uri: string) {
  if (!uri.includes("/")) {
    return `moonshot/${uri}`;
  }
  if (!uri.includes(":")) {
    return `${uri}:latest`;
  }
  return uri;
}

function getBaseUrl() {
  const baseUrl = env.kimiOpenUrl.replace(/\/$/, "");
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function getApiKey() {
  if (!env.kimiApiKey) {
    throw new Error("KIMI_API_KEY is missing. Formula tools require a Kimi API key.");
  }

  return env.kimiApiKey;
}

async function formulaFetch(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Kimi formula request timed out while calling ${path}.`));
  }, 20_000);

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      const normalizedBody = body.toLowerCase();

      if (
        response.status === 401 &&
        (
          normalizedBody.includes("invalid authentication") ||
          normalizedBody.includes("incorrect api key provided")
        )
      ) {
        throw new Error(
          "KIMI_API_KEY is invalid for official Kimi tools. Update the server environment with a valid key from platform.kimi.ai.",
        );
      }

      throw new Error(`Kimi formula request failed (${response.status}): ${body.slice(0, 400)}`);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class KimiFormulaToolExecutor {
  async getEnabledTools(formulaUris: string[]) {
    const tools: ToolDefinition[] = [];

    for (const uri of formulaUris.map(normalizeFormulaUri)) {
      const cached = toolCache.get(uri);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        tools.push(...cached.tools);
        continue;
      }

      const response = await formulaFetch(`/formulas/${uri}/tools`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const payload = (await response.json()) as { tools?: ToolDefinition[] };
      const fetchedTools = payload.tools ?? [];
      toolCache.set(uri, {
        fetchedAt: Date.now(),
        tools: fetchedTools,
      });
      tools.push(...fetchedTools);
    }

    return tools;
  }

  async executeToolCalls(params: {
    toolCalls: ToolCall[];
    enabledFormulaUris: string[];
  }) {
    const normalizedUris = params.enabledFormulaUris.map(normalizeFormulaUri);
    const toolIndex = new Map<string, string>();

    for (const uri of normalizedUris) {
      const tools = await this.getEnabledTools([uri]);
      for (const tool of tools) {
        const functionName =
          typeof tool === "object" && tool && "function" in tool
            ? ((tool.function as { name?: string })?.name ?? "")
            : "";
        if (functionName) {
          toolIndex.set(functionName, uri);
        }
      }
    }

    const results: Array<{
      toolCallId: string;
      toolName: string;
      content: string;
    }> = [];

    for (const toolCall of params.toolCalls) {
      const uri = toolIndex.get(toolCall.function.name);
      if (!uri) {
        continue;
      }

      const response = await formulaFetch(`/formulas/${uri}/fibers`, {
        method: "POST",
        body: JSON.stringify({
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        }),
      });

      const resultPayload = await response.text();
      results.push({
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        content: resultPayload,
      });
    }

    return results;
  }
}

export { normalizeFormulaUri };

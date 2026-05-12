import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../server/trpc/router";
import { logClientError } from "@/lib/debug";
import { buildAuthenticatedHeaders } from "@/lib/request-auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export const trpc = createTRPCReact<AppRouter>();
export const queryClient = new QueryClient();

async function readAccessToken() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

function readContentType(response: Response) {
  return response.headers.get("content-type")?.toLowerCase() ?? "";
}

function classifyHttpBody(status: number, bodyPreview: string) {
  const normalized = bodyPreview.toLowerCase();

  if (status === 401 || status === 403 || normalized.includes("unauthorized")) {
    return "auth";
  }

  if (
    normalized.includes("an error occurred") ||
    normalized.includes("<!doctype html") ||
    normalized.includes("<html")
  ) {
    return "backend-timeout";
  }

  if (normalized.includes("database") || normalized.includes("relation")) {
    return "db-error";
  }

  return status >= 500 ? "backend-timeout" : "transport";
}

function toTrpcErrorCode(status: number) {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 408:
      return "TIMEOUT";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

export async function normalizeTrpcHttpResponse(
  response: Response,
  input: RequestInfo | URL,
) {
  if (response.ok) {
    return response;
  }

  const contentType = readContentType(response);
  if (contentType.includes("application/json")) {
    return response;
  }

  const bodyPreview = (await response.clone().text().catch(() => ""))
    .trim()
    .slice(0, 300);
  const code = toTrpcErrorCode(response.status);
  const traceId = response.headers.get("x-trace-id") ?? undefined;
  const category = classifyHttpBody(response.status, bodyPreview);

  logClientError(
    "trpc.fetch.non-json-error",
    new Error(`HTTP ${response.status} returned ${contentType || "unknown"}`),
    {
      url: typeof input === "string" ? input : input.toString(),
      status: response.status,
      contentType: contentType || null,
      bodyPreview,
      traceId: traceId ?? null,
      category,
    },
  );

  return Response.json(
    {
      error: {
        message: bodyPreview || `HTTP ${response.status}`,
        code,
        data: {
          code,
          httpStatus: response.status,
          category,
          traceId,
          bodyPreview,
        },
      },
    },
    {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "content-type": "application/json",
        ...(traceId ? { "x-trace-id": traceId } : {}),
      },
    },
  );
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const headers = await buildAuthenticatedHeaders(
          readAccessToken,
          init?.headers
        );
        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          logClientError(
            "trpc.fetch.failed",
            new Error(`HTTP ${response.status}`),
            {
              url: typeof input === "string" ? input : input.toString(),
              status: response.status,
            }
          );
        }

        return normalizeTrpcHttpResponse(response, input);
      },
    }),
  ],
});

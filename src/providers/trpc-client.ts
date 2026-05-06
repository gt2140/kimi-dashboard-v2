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

        return response;
      },
    }),
  ],
});

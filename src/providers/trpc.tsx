import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { AppRouter } from "../../server/trpc/router";
import { logClientDebug, logClientError } from "@/lib/debug";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { buildAuthenticatedHeaders } from "@/lib/request-auth";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();

async function readAccessToken() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

const trpcClient = trpc.createClient({
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

type BackendSessionState = {
  phase: "idle" | "syncing" | "ready" | "error";
  backendReady: boolean;
  error: string | null;
  lastSyncedAt: number | null;
};

const defaultBackendSessionState: BackendSessionState = {
  phase: "idle",
  backendReady: false,
  error: null,
  lastSyncedAt: null,
};

let backendSessionState: BackendSessionState = defaultBackendSessionState;
let backendSessionPromise: Promise<boolean> | null = null;
const backendSessionListeners = new Set<() => void>();

function emitBackendSessionState() {
  for (const listener of backendSessionListeners) {
    listener();
  }
}

function setBackendSessionState(next: Partial<BackendSessionState>) {
  backendSessionState = {
    ...backendSessionState,
    ...next,
  };
  emitBackendSessionState();
}

export function subscribeBackendSessionState(listener: () => void) {
  backendSessionListeners.add(listener);
  return () => backendSessionListeners.delete(listener);
}

export function getBackendSessionState() {
  return backendSessionState;
}

export function resetBackendSessionState() {
  backendSessionPromise = null;
  backendSessionState = defaultBackendSessionState;
  emitBackendSessionState();
}

export async function ensureBackendSession(options?: { force?: boolean }) {
  if (!isSupabaseConfigured) {
    return false;
  }

  if (
    !options?.force &&
    backendSessionState.backendReady &&
    backendSessionState.phase === "ready"
  ) {
    return true;
  }

  if (backendSessionPromise) {
    return backendSessionPromise;
  }

  backendSessionPromise = (async () => {
    setBackendSessionState({
      phase: "syncing",
      error: null,
    });

    const { data } = await getSupabaseBrowserClient().auth.getSession();
    const accessToken = data.session?.access_token;
    logClientDebug("auth.sync.ensure", {
      force: Boolean(options?.force),
      hasSession: Boolean(data.session),
      userId: data.session?.user?.id ?? null,
    });

    if (!accessToken) {
      resetBackendSessionState();
      return false;
    }

    try {
      const result = await trpcClient.auth.syncSession.mutate({ accessToken });
      logClientDebug("auth.sync.ensure.result", result);
      setBackendSessionState({
        phase: "ready",
        backendReady: true,
        error: null,
        lastSyncedAt: Date.now(),
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sync the backend session.";
      logClientError("auth.sync.ensure.failed", error);
      setBackendSessionState({
        phase: "error",
        backendReady: false,
        error: message,
      });
      return false;
    } finally {
      backendSessionPromise = null;
    }
  })();

  return backendSessionPromise;
}

export async function syncBackendSessionOnce() {
  return ensureBackendSession({ force: true });
}

export function useBackendSessionState() {
  return useSyncExternalStore(
    subscribeBackendSessionState,
    getBackendSessionState,
    getBackendSessionState
  );
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SupabaseAuthSync />
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

function SupabaseAuthSync() {
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;

    async function syncBackendSession() {
      const synced = await ensureBackendSession();
      if (!active || !synced) {
        return;
      }

      logClientDebug("auth.sync.effect.success");
      await utils.invalidate();
    }

    void syncBackendSession();

    const {
      data: { subscription },
    } = getSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      logClientDebug("auth.sync.on-auth-state-change", {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });

      if (session?.access_token) {
        void ensureBackendSession({ force: true })
          .then(synced => {
            if (!synced) {
              return;
            }

            logClientDebug("auth.sync.on-auth-state-change.success");
            return utils.invalidate();
          })
          .catch(error => {
            logClientError("auth.sync.on-auth-state-change.failed", error);
          });
      } else {
        resetBackendSessionState();
        void utils.invalidate();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [utils]);

  return null;
}

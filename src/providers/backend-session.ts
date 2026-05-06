import { useSyncExternalStore } from "react";
import { logClientDebug, logClientError } from "@/lib/debug";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { trpcClient } from "@/providers/trpc-client";

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
      const hadWorkingSession =
        backendSessionState.backendReady &&
        backendSessionState.lastSyncedAt !== null;
      logClientError("auth.sync.ensure.failed", error);
      setBackendSessionState({
        phase: "error",
        backendReady: hadWorkingSession,
        error: message,
      });
      return hadWorkingSession;
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

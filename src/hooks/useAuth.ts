import { trpc } from "@/providers/trpc";
import {
  ensureBackendSession,
  resetBackendSessionState,
  useBackendSessionState,
} from "@/providers/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { LOGIN_PATH } from "@/const";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { formatRuntimeError } from "@/lib/app-errors";
import { resetChatStore } from "@/hooks/useStore";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function readSetupError(status: unknown) {
  if (!status || typeof status !== "object") {
    return null;
  }

  const candidate = status as {
    app?: {
      sessionSecretConfigured?: boolean;
      supabaseUrlConfigured?: boolean;
      supabaseAnonKeyConfigured?: boolean;
      databaseConfigured?: boolean;
    };
    db?: {
      ok?: boolean;
      message?: string;
    };
  };

  if (candidate.app?.sessionSecretConfigured === false) {
    return "Setup error: SESSION_SECRET is missing on the backend.";
  }

  if (candidate.app?.supabaseUrlConfigured === false) {
    return "Setup error: SUPABASE_URL is missing on the backend.";
  }

  if (candidate.app?.supabaseAnonKeyConfigured === false) {
    return "Setup error: the Supabase anon key is missing on the backend.";
  }

  if (candidate.app?.databaseConfigured === false) {
    return "Setup error: DATABASE_URL is missing or invalid.";
  }

  if (candidate.db?.ok === false) {
    return `Setup error: ${candidate.db.message ?? "Database connection failed."}`;
  }

  return null;
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const backendSession = useBackendSessionState();
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  const [hasSupabaseSession, setHasSupabaseSession] = useState(false);

  const utils = trpc.useUtils();
  const authStatus = trpc.auth.status.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
  });
  const {
    data: backendUser,
    isLoading,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    enabled:
      sessionReady &&
      (!isSupabaseConfigured ||
        (hasSupabaseSession && backendSession.backendReady)),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;

    async function hydrateSession() {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!active) {
        return;
      }

      const hasSession = Boolean(data.session);
      setHasSupabaseSession(hasSession);

      if (!hasSession) {
        resetBackendSessionState();
        setSessionReady(true);
        return;
      }

      const synced = await ensureBackendSession();
      if (!active) {
        return;
      }

      setSessionReady(true);
      if (!synced) {
        return;
      }

      await utils.auth.me.invalidate();
    }

    void hydrateSession();

    const {
      data: { subscription },
    } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      setHasSupabaseSession(Boolean(session));
      if (!session) {
        resetBackendSessionState();
        setSessionReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [utils.auth.me]);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        await getSupabaseBrowserClient().auth.signOut();
      } catch {
        // Continue with local cleanup even if Supabase sign-out fails.
      }
    }

    try {
      await logoutMutation.mutateAsync();
    } catch {
      // Backend cookie cleanup is best-effort because Supabase owns the primary session.
    }

    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("sb-")) {
        window.localStorage.removeItem(key);
      }
    }

    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith("sb-")) {
        window.sessionStorage.removeItem(key);
      }
    }

    resetChatStore();
    resetBackendSessionState();
    queryClient.clear();
    setHasSupabaseSession(false);
    setSessionReady(true);
    await utils.invalidate();
    window.location.replace(redirectPath);
  }, [logoutMutation, queryClient, redirectPath, utils]);

  const setupError = readSetupError(authStatus.data);
  const syncError =
    hasSupabaseSession && !backendSession.backendReady ? backendSession.error : null;
  const resolvedError =
    setupError ??
    syncError ??
    (!backendUser && error ? formatRuntimeError(error, "Auth") : null);

  const isAuthenticated = Boolean(backendUser);
  const authLoading =
    !sessionReady ||
    logoutMutation.isPending ||
    authStatus.isLoading ||
    (hasSupabaseSession &&
      backendSession.phase === "syncing" &&
      !backendSession.backendReady) ||
    (hasSupabaseSession && backendSession.backendReady && isLoading);

  useEffect(() => {
    if (redirectOnUnauthenticated && !authLoading && !isAuthenticated) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath, { replace: true });
      }
    }
  }, [
    authLoading,
    isAuthenticated,
    navigate,
    redirectOnUnauthenticated,
    redirectPath,
  ]);

  return useMemo(
    () => ({
      user: backendUser ?? null,
      isAuthenticated,
      isLoading: authLoading,
      error: resolvedError,
      backendReady: Boolean(backendUser),
      backendLoading: isLoading,
      hasSupabaseSession,
      logout,
      refresh: refetch,
      setupStatus: authStatus.data ?? null,
    }),
    [
      authLoading,
      authStatus.data,
      backendUser,
      hasSupabaseSession,
      isAuthenticated,
      isLoading,
      logout,
      refetch,
      resolvedError,
    ]
  );
}

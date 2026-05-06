import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { logClientDebug, logClientError } from "@/lib/debug";
import {
  ensureBackendSession,
  resetBackendSessionState,
} from "@/providers/backend-session";
import { queryClient, trpc, trpcClient } from "@/providers/trpc-client";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

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

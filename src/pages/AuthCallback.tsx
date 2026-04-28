import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_CALLBACK_PATH, LOGIN_PATH } from "@/const";
import { logClientDebug, logClientError } from "@/lib/debug";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { ensureBackendSession } from "@/providers/trpc";

async function waitForSupabaseSession(attempts = 10, delayMs = 400) {
  const supabase = getSupabaseBrowserClient();

  for (let index = 0; index < attempts; index += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    logClientDebug("auth.callback.poll-session", {
      attempt: index + 1,
      hasSession: Boolean(data.session),
      userId: data.session?.user?.id ?? null,
    });

    if (data.session) {
      return data.session;
    }

    await new Promise(resolve => window.setTimeout(resolve, delayMs));
  }

  return null;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function finishLogin(accessToken?: string | null) {
      logClientDebug("auth.callback.finish-login", {
        hasAccessToken: Boolean(accessToken),
      });

      if (accessToken) {
        try {
          logClientDebug("auth.callback.sync-session.start");
          const synced = await ensureBackendSession({ force: true });
          if (!synced) {
            throw new Error(
              "The backend session could not be synchronized after Google sign-in."
            );
          }
          logClientDebug("auth.callback.sync-session.success");
        } catch (error) {
          logClientError("auth.callback.sync-session.failed", error);
          if (active) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Unable to finish sign-in."
            );
            return;
          }
        }
      }

      if (active) {
        if (window.location.hash) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`
          );
        }
        logClientDebug("auth.callback.navigate.dashboard");
        navigate("/dashboard", { replace: true });
      }
    }

    async function completeLogin() {
      if (!isSupabaseConfigured) {
        if (active) {
          setErrorMessage("Supabase is not configured in this environment.");
        }
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const tokenFromHash = hashParams.get("access_token");
      const refreshTokenFromHash = hashParams.get("refresh_token");
      const authError =
        url.searchParams.get("error_description") ??
        url.searchParams.get("error") ??
        hashParams.get("error_description") ??
        hashParams.get("error");

      logClientDebug("auth.callback.enter", {
        path: AUTH_CALLBACK_PATH,
        href: window.location.href,
        hasCode: Boolean(code),
        hasHashAccessToken: Boolean(tokenFromHash),
        hasHashRefreshToken: Boolean(refreshTokenFromHash),
      });

      if (authError) {
        if (active) {
          setErrorMessage(authError);
        }
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, authSession) => {
          logClientDebug("auth.callback.on-auth-state-change", {
            event,
            hasSession: Boolean(authSession),
            userId: authSession?.user?.id ?? null,
          });

          if (authSession?.access_token) {
            void finishLogin(authSession.access_token);
          }
        });

        let session = null;

        if (tokenFromHash && refreshTokenFromHash) {
          logClientDebug("auth.callback.set-session.start");
          const { data, error } = await supabase.auth.setSession({
            access_token: tokenFromHash,
            refresh_token: refreshTokenFromHash,
          });
          if (error) {
            throw error;
          }
          session = data.session;
          logClientDebug("auth.callback.set-session.result", {
            hasSession: Boolean(session),
            userId: session?.user?.id ?? null,
          });
        } else if (code) {
          logClientDebug("auth.callback.exchange-code.start");
          const { data, error } =
            await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
          session = data.session;
          logClientDebug("auth.callback.exchange-code.result", {
            hasSession: Boolean(session),
            userId: session?.user?.id ?? null,
          });
        } else if (tokenFromHash) {
          logClientDebug("auth.callback.hash-access-token-only", {
            hasRefreshToken: false,
          });
          await finishLogin(tokenFromHash);
          subscription.unsubscribe();
          return;
        } else {
          logClientDebug("auth.callback.wait-local-session.start");
          session = await waitForSupabaseSession();
        }

        if (!session) {
          subscription.unsubscribe();

          if (active) {
            setErrorMessage(
              "No active session returned by Supabase after the OAuth callback."
            );
          }
          return;
        }

        await finishLogin(session.access_token);
        subscription.unsubscribe();
      } catch (error) {
        logClientError("auth.callback.failed", error, {
          href: window.location.href,
        });
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : "Authentication failed."
          );
        }
      }
    }

    void completeLogin();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (errorMessage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">
            We could not complete the sign-in.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{errorMessage}</p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate(LOGIN_PATH, { replace: true })}
        >
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Completing sign-in...</p>
    </div>
  );
}

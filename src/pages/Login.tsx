import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { getAuthCallbackUrl } from "@/const";
import { useAuth } from "@/hooks/useAuth";
import { logClientDebug, logClientError } from "@/lib/debug";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      logClientDebug("login.redirect.dashboard", {
        reason: "existing-session",
      });
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  async function handleGoogleLogin() {
    try {
      setAuthError(null);
      const callbackUrl = getAuthCallbackUrl();
      logClientDebug("login.click", {
        redirectTo: callbackUrl,
        origin: window.location.origin,
      });

      const { data } = await getSupabaseBrowserClient().auth.getSession();
      logClientDebug("login.current-session", {
        hasSession: Boolean(data.session),
        userId: data.session?.user?.id ?? null,
      });

      if (data.session) {
        navigate("/dashboard", { replace: true });
        return;
      }

      await getSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      });
    } catch (error) {
      logClientError("login.failed", error, {
        redirectTo: getAuthCallbackUrl(),
      });
      setAuthError(
        error instanceof Error
          ? error.message
          : "Unable to start Google sign-in."
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <Sparkles className="mb-4 h-5 w-5 text-muted-foreground/20" />
      <h1 className="mb-6 text-[15px] font-medium text-foreground">Aura</h1>
      <Button
        size="sm"
        className="h-8 text-[12px]"
        disabled={!isSupabaseConfigured || Boolean(error)}
        onClick={() => {
          void handleGoogleLogin();
        }}
      >
        {isLoading ? "Checking session..." : "Continue with Google"}
      </Button>
      {authError && (
        <p className="mt-3 max-w-xs text-center text-[11px] text-destructive/80">
          {authError}
        </p>
      )}
      {!authError && error && (
        <p className="mt-3 max-w-sm text-center text-[11px] text-destructive/80">
          {error}
        </p>
      )}
      {!authError && !isLoading && !isAuthenticated && (
        <p className="mt-3 max-w-sm text-center text-[11px] text-muted-foreground/55">
          OAuth callback: <code>{getAuthCallbackUrl()}</code>
        </p>
      )}
      {!isSupabaseConfigured && (
        <p className="mt-3 max-w-xs text-center text-[11px] text-muted-foreground/45">
          Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file to
          enable login.
        </p>
      )}
      {isSupabaseConfigured && !isLoading && !isAuthenticated && authError == null && (
        <p className="mt-2 max-w-sm text-center text-[11px] text-muted-foreground/45">
          Sign-in completes only after the browser session and backend session
          are both synchronized.
        </p>
      )}
    </div>
  );
}

import { ArrowLeft, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { getAuthCallbackUrl } from "@/const";
import { useAuth } from "@/hooks/useAuth";
import { logClientDebug, logClientError } from "@/lib/debug";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { clearSupabaseBrowserState } from "@/lib/supabase-session";

const AURA_LANDING_URL = "https://landing-aura-v1-3hah.vercel.app";

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

      clearSupabaseBrowserState();
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
    <div className="relative min-h-screen overflow-hidden bg-[#f7f6f1] text-[#111111]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.98),transparent_34%),linear-gradient(180deg,#fbfaf7_0%,#f1efe7_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-10%] top-[8%] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95),transparent_72%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[22%] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(225,219,201,0.92),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-8%] left-[15%] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(222,229,220,0.8),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6">
        <div>
          <a
            href={AURA_LANDING_URL}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-[11px] font-medium tracking-[0.18em] text-black/60 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-black/20 hover:text-black"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Aura
          </a>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <section className="w-full max-w-[27rem] rounded-[32px] border border-black/[0.06] bg-white/86 px-7 py-9 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:px-9 sm:py-10">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <div className="mb-4 inline-flex rounded-full border border-black/8 bg-[#faf8f2] px-4 py-1.5 text-[11px] font-medium tracking-[0.24em] text-black/48">
                DASHBOARD ACCESS
              </div>
              <Sparkles className="mb-4 h-5 w-5 text-black/25" />
              <h1 className="text-[2.35rem] font-semibold tracking-[-0.06em] text-[#151311]">
                Welcome to Aura
              </h1>
              <p className="mt-3 max-w-[22rem] text-[0.98rem] leading-6 text-black/58">
                Sign in with Google to open your dashboard, restore your saved conversations, and continue where you left off.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-sm">
              <Button
                size="lg"
                className="h-12 w-full rounded-[14px] bg-[#151311] text-[0.98rem] font-medium text-white hover:bg-black"
                disabled={!isSupabaseConfigured || Boolean(error)}
                onClick={() => {
                  void handleGoogleLogin();
                }}
              >
                {isLoading ? "Checking session..." : "Continue with Google"}
              </Button>

              <p className="mt-4 text-center text-[12px] leading-5 text-black/44">
                Secure access powered by Google and your existing Aura account.
              </p>

              {authError && (
                <p className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-center text-[12px] leading-5 text-red-700">
                  {authError}
                </p>
              )}
              {!authError && error && (
                <p className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-center text-[12px] leading-5 text-red-700">
                  {error}
                </p>
              )}
              {!isSupabaseConfigured && (
                <p className="mt-5 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[12px] leading-5 text-amber-800">
                  Login is temporarily unavailable because the Supabase public keys are missing in this environment.
                </p>
              )}
              {isSupabaseConfigured &&
                !isLoading &&
                !isAuthenticated &&
                authError == null &&
                !error && (
                  <p className="mt-5 text-center text-[12px] leading-5 text-black/46">
                    If Google sign-in does not open, return to the Aura home page and try again from Enter App.
                  </p>
                )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

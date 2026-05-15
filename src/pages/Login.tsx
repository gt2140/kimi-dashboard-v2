import { Apple, ArrowLeft, Github, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { getAuthCallbackUrl } from "@/const";
import { useAuth } from "@/hooks/useAuth";
import {
  signInWithEthereumWallet,
  signInWithProvider,
  type LoginProvider,
} from "@/lib/auth-login";
import { formatRuntimeError } from "@/lib/app-errors";
import { logClientDebug, logClientError } from "@/lib/debug";
import { isSupabaseConfigured } from "@/lib/supabase";

const AURA_LANDING_URL = "https://landing-aura-v1-3hah.vercel.app";

type AuthProviderOption = {
  id: LoginProvider | "web3";
  label: string;
  detail: string;
  icon: React.ReactNode;
};

const AUTH_PROVIDERS: AuthProviderOption[] = [
  {
    id: "google",
    label: "Continue with Google",
    detail: "Fastest path back into your workspace.",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: "apple",
    label: "Continue with Apple",
    detail: "Private OAuth sign-in through Supabase.",
    icon: <Apple className="h-4 w-4" />,
  },
  {
    id: "github",
    label: "Continue with GitHub",
    detail: "Useful for technical and builder accounts.",
    icon: <Github className="h-4 w-4" />,
  },
  {
    id: "web3",
    label: "Web3 Wallet",
    detail: "Ethereum wallet signature, no password.",
    icon: <WalletCards className="h-4 w-4" />,
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<
    AuthProviderOption["id"] | null
  >(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      logClientDebug("login.redirect.dashboard", {
        reason: "existing-session",
      });
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  async function handleLogin(provider: AuthProviderOption["id"]) {
    try {
      setAuthError(null);
      setPendingProvider(provider);
      const callbackUrl = getAuthCallbackUrl();
      logClientDebug("login.click", {
        provider,
        redirectTo: callbackUrl,
        origin: window.location.origin,
      });

      const result =
        provider === "web3"
          ? await signInWithEthereumWallet()
          : await signInWithProvider(provider);
      if (result === "existing-session") {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      logClientError("login.failed", error, {
        provider,
        redirectTo: getAuthCallbackUrl(),
      });
      setAuthError(formatRuntimeError(error, "Auth"));
    } finally {
      setPendingProvider(null);
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
          <section className="w-full max-w-[29rem] rounded-[28px] border border-black/[0.06] bg-white/86 px-5 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:rounded-[32px] sm:px-9 sm:py-10">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <div className="mb-3 inline-flex rounded-full border border-black/8 bg-[#faf8f2] px-4 py-1.5 text-[10px] font-medium tracking-[0.22em] text-black/48 sm:mb-4 sm:text-[11px]">
                DASHBOARD ACCESS
              </div>
              <Sparkles className="mb-3 h-5 w-5 text-black/25 sm:mb-4" />
              <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#151311] sm:text-[2.35rem]">
                Welcome to Aura
              </h1>
              <p className="mt-2 max-w-[22rem] text-[0.92rem] leading-6 text-black/58 sm:mt-3 sm:text-[0.98rem]">
                Open your AI workspace with Supabase Auth, then continue your chats, models, agents, and vault context.
              </p>
            </div>

            <div className="mx-auto mt-6 max-w-sm sm:mt-8">
              <div className="grid gap-2.5">
                {AUTH_PROVIDERS.map(provider => (
                  <button
                    key={provider.id}
                    type="button"
                    className="group flex min-h-14 w-full items-center gap-3 rounded-[16px] border border-black/[0.08] bg-white/76 px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-black/15 hover:bg-white disabled:pointer-events-none disabled:opacity-55"
                    disabled={
                      !isSupabaseConfigured ||
                      Boolean(error) ||
                      isLoading ||
                      pendingProvider !== null
                    }
                    onClick={() => {
                      void handleLogin(provider.id);
                    }}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-[#faf8f2] text-black/55 transition-colors group-hover:text-black">
                      {pendingProvider === provider.id ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border border-black/20 border-t-black" />
                      ) : (
                        provider.icon
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-black/82">
                        {provider.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-black/45">
                        {provider.detail}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-4 text-center text-[12px] leading-5 text-black/44">
                Apple, GitHub, and Web3 require their providers to be enabled in Supabase.
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
                    If a provider does not open, check that it is enabled in Supabase and try again.
                  </p>
                )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

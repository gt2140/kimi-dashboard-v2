import { getAuthCallbackUrl } from "@/const";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { clearSupabaseBrowserState } from "@/lib/supabase-session";

export type LoginProvider = "google" | "apple" | "github";

export const WEB3_SIGN_IN_STATEMENT =
  "Sign in to Aura to access your private AI workspace.";

type AuthClientLike = {
  auth: {
    getSession: () => Promise<{ data: { session: unknown | null } }>;
    signInWithOAuth: (input: {
      provider: LoginProvider;
      options: { redirectTo: string };
    }) => Promise<unknown>;
    signInWithWeb3?: (input: {
      chain: "ethereum";
      statement: string;
    }) => Promise<unknown>;
  };
};

type ProviderLoginDependencies = {
  client?: AuthClientLike;
  callbackUrl?: string;
  clearBrowserState?: () => void;
};

type Web3LoginDependencies = {
  client?: AuthClientLike;
  ethereum?: unknown;
  clearBrowserState?: () => void;
};

function getInjectedEthereum() {
  return (globalThis as typeof globalThis & { ethereum?: unknown }).ethereum;
}

export async function signInWithProvider(
  provider: LoginProvider,
  dependencies: ProviderLoginDependencies = {},
) {
  const client = dependencies.client ?? getSupabaseBrowserClient();
  const callbackUrl = dependencies.callbackUrl ?? getAuthCallbackUrl();
  const clearBrowserState =
    dependencies.clearBrowserState ?? clearSupabaseBrowserState;
  const { data } = await client.auth.getSession();

  if (data.session) {
    return "existing-session" as const;
  }

  clearBrowserState();
  await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callbackUrl },
  });
  return "redirect-started" as const;
}

export async function signInWithEthereumWallet(
  dependencies: Web3LoginDependencies = {},
) {
  const ethereum = dependencies.ethereum ?? getInjectedEthereum();
  if (!ethereum) {
    throw new Error(
      "No Ethereum wallet detected. Install a wallet such as MetaMask, then try Web3 sign-in again.",
    );
  }

  const client = dependencies.client ?? getSupabaseBrowserClient();
  const clearBrowserState =
    dependencies.clearBrowserState ?? clearSupabaseBrowserState;
  const { data } = await client.auth.getSession();

  if (data.session) {
    return "existing-session" as const;
  }

  if (!client.auth.signInWithWeb3) {
    throw new Error(
      "Supabase Web3 sign-in is not available in this client version.",
    );
  }

  clearBrowserState();
  await client.auth.signInWithWeb3({
    chain: "ethereum",
    statement: WEB3_SIGN_IN_STATEMENT,
  });
  return "web3-started" as const;
}

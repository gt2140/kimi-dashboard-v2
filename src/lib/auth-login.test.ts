import { describe, expect, it, vi } from "vitest";
import {
  signInWithEthereumWallet,
  signInWithProvider,
  WEB3_SIGN_IN_STATEMENT,
} from "./auth-login";

function createAuthClient(session: unknown = null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithWeb3: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  };
}

describe("auth-login", () => {
  it("starts Supabase OAuth with the selected provider and callback URL", async () => {
    const client = createAuthClient();

    await signInWithProvider("github", {
      client,
      callbackUrl: "https://app.example.com/auth/callback",
      clearBrowserState: vi.fn(),
    });

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "github",
      options: { redirectTo: "https://app.example.com/auth/callback" },
    });
  });

  it("does not clear browser state or redirect when a Supabase session already exists", async () => {
    const clearBrowserState = vi.fn();
    const client = createAuthClient({ user: { id: "user-1" } });

    await expect(
      signInWithProvider("apple", {
        client,
        callbackUrl: "https://app.example.com/auth/callback",
        clearBrowserState,
      }),
    ).resolves.toBe("existing-session");

    expect(clearBrowserState).not.toHaveBeenCalled();
    expect(client.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("rejects Ethereum Web3 sign-in when no injected wallet is present", async () => {
    const client = createAuthClient();

    await expect(
      signInWithEthereumWallet({
        client,
        ethereum: undefined,
        clearBrowserState: vi.fn(),
      }),
    ).rejects.toThrow("No Ethereum wallet detected");
  });

  it("starts Supabase Ethereum Web3 login with a product-specific statement", async () => {
    const client = createAuthClient();

    await signInWithEthereumWallet({
      client,
      ethereum: {},
      clearBrowserState: vi.fn(),
    });

    expect(client.auth.signInWithWeb3).toHaveBeenCalledWith({
      chain: "ethereum",
      statement: WEB3_SIGN_IN_STATEMENT,
    });
  });
});

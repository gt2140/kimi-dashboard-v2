import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: false,
  getSupabaseBrowserClient: vi.fn(),
}));

describe("Login", () => {
  it("shows guarded multi-provider access without exposing callback debug copy", async () => {
    const { default: Login } = await import("./Login");

    const markup = renderToStaticMarkup(createElement(Login));

    expect(markup).toContain("Back to Aura");
    expect(markup).toContain("Continue with Google");
    expect(markup).toContain("Continue with Apple");
    expect(markup).toContain("Continue with GitHub");
    expect(markup).toContain("Web3 Wallet");
    expect(markup).toContain("disabled");
    expect(markup).toContain("Supabase public keys are missing");
    expect(markup).toContain('href="https://landing-aura-v1-3hah.vercel.app"');
    expect(markup).not.toContain("OAuth callback:");
    expect(markup).not.toContain("both synchronized");
  });
});

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

describe("Login", () => {
  it("shows a path back to the landing page without exposing callback debug copy", async () => {
    const { default: Login } = await import("./Login");

    const markup = renderToStaticMarkup(createElement(Login));

    expect(markup).toContain("Back to Aura");
    expect(markup).toContain('href="https://landing-aura-v1-3hah.vercel.app"');
    expect(markup).not.toContain("OAuth callback:");
    expect(markup).not.toContain("both synchronized");
  });
});

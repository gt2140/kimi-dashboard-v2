import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./components/layout/DashboardLayout", async () => {
  const { Outlet } = await import("react-router");

  return {
    DashboardLayout: () =>
      createElement("section", { "data-layout": "dashboard" }, createElement(Outlet)),
  };
});

vi.mock("./pages/Login", () => ({
  default: () => createElement("div", null, "Login"),
}));

vi.mock("./pages/Home", () => ({
  default: () => createElement("div", null, "Whitepaper"),
}));

vi.mock("./pages/AuthCallback", () => ({
  default: () => createElement("div", null, "AuthCallback"),
}));

vi.mock("./pages/Dashboard", () => ({
  default: () => createElement("div", null, "Overview"),
}));

vi.mock("./pages/KimiChat", () => ({
  default: () => createElement("div", null, "KimiChat"),
}));

vi.mock("./pages/KimiAgents", () => ({
  default: () => createElement("div", null, "KimiAgents"),
}));

vi.mock("./pages/KimiAgentSettings", () => ({
  default: () => createElement("div", null, "KimiAgentSettings"),
}));

vi.mock("./pages/KimiVault", () => ({
  default: () => createElement("div", null, "KimiVault"),
}));

vi.mock("./pages/Profile", () => ({
  default: () => createElement("div", null, "Profile"),
}));

vi.mock("./pages/NotFound", () => ({
  default: () => createElement("div", null, "NotFound"),
}));

describe("App routes", () => {
  it("renders the public whitepaper route", { timeout: 15000 }, async () => {
    const { default: App } = await import("./App");

    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/whitepaper"] },
        createElement(App)
      )
    );

    expect(markup).toContain("Whitepaper");
  });

  it("renders the mining route inside the dashboard layout", async () => {
    const { default: App } = await import("./App");

    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/bounties"] },
        createElement(App)
      )
    );

    expect(markup).toContain('data-layout="dashboard"');
    expect(markup).toContain("Mining");
    expect(markup).toContain("Explore active mining opportunities");
  });
});

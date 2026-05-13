import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      name: "Gaston",
      email: "gaston@example.com",
      avatar: null,
    },
  }),
}));

vi.mock("@/hooks/useStore", () => ({
  useChatStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeAgentId: null,
      setActiveAgent: vi.fn(),
    }),
}));

vi.mock("@/hooks/useAgentCatalog", () => ({
  useAgentCatalog: () => ({
    favoriteAgents: [],
  }),
}));

vi.mock("@/hooks/useKimiChatData", () => ({
  useKimiChatData: () => ({
    sessions: [],
    activeConversationId: null,
    selectConversation: vi.fn(),
    removeConversation: vi.fn(),
  }),
}));

describe("Sidebar", () => {
  it("includes the Mining nav item and marks it active on the bounties route", async () => {
    const { Sidebar } = await import("./Sidebar");

    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/bounties"] },
        createElement(Sidebar, {
          collapsed: false,
          onToggle: vi.fn(),
        })
      )
    );

    expect(markup).toContain("Mining");
    expect(markup).toContain("Chat");
    expect(markup).toContain("Agents");
    expect(markup).toContain("Vault");
    expect(markup).not.toContain("Kimi Chat");
    expect(markup).not.toContain("Kimi Agents");
    expect(markup).not.toContain("Kimi Vault");
    expect(markup).toContain("bg-sidebar-accent text-sidebar-accent-foreground");
  });
});

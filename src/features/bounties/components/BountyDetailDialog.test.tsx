import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { bountySeedData } from "../data";
import { BountyDetailDialog } from "./BountyDetailDialog";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  DialogContent: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  DialogDescription: ({ children }: { children: ReactNode }) =>
    createElement("p", null, children),
  DialogHeader: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  DialogTitle: ({ children }: { children: ReactNode }) =>
    createElement("h2", null, children),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  TabsList: ({ children }: { children: ReactNode }) =>
    createElement("div", null, children),
  TabsTrigger: ({ children }: { children: ReactNode }) =>
    createElement("button", null, children),
  TabsContent: ({ children }: { children: ReactNode }) =>
    createElement("section", null, children),
}));

describe("BountyDetailDialog", () => {
  it("renders the vault context section only when the selected bounty has it", () => {
    const withVaultContext = renderToStaticMarkup(
      createElement(BountyDetailDialog, {
        bounty: bountySeedData[2],
        open: true,
        onOpenChange: vi.fn(),
      })
    );

    const withoutVaultContext = renderToStaticMarkup(
      createElement(BountyDetailDialog, {
        bounty: bountySeedData[0],
        open: true,
        onOpenChange: vi.fn(),
      })
    );

    expect(withVaultContext).toContain("Vault context");
    expect(withVaultContext).toContain(
      "Full protocol v2.1 documentation + 50 test cases attached"
    );
    expect(withoutVaultContext).not.toContain("Vault context");
  });
});

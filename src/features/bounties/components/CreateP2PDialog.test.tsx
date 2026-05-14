import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateP2PDialog } from "./CreateP2PDialog";

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

describe("CreateP2PDialog", () => {
  it("renders the draft mining form fields and mock messaging", () => {
    const markup = renderToStaticMarkup(
      createElement(CreateP2PDialog, {
        open: true,
        onOpenChange: vi.fn(),
      })
    );

    expect(markup).toContain("Create P2P mining");
    expect(markup).toContain("Draft snapshot");
    expect(markup).toContain("Save draft");
    expect(markup).toContain("Local draft only");
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { bountySeedData } from "../data";
import { BountyTable } from "./BountyTable";

describe("BountyTable", () => {
  it("renders the empty state when no bounties match", () => {
    const markup = renderToStaticMarkup(
      createElement(BountyTable, {
        bounties: [],
        onSelect: vi.fn(),
      })
    );

    expect(markup).toContain("No mining found");
    expect(markup).toContain("Try another filter or search query.");
  });

  it("renders bounty rows/cards with the core reward metadata", () => {
    const markup = renderToStaticMarkup(
      createElement(BountyTable, {
        bounties: [bountySeedData[0]],
        onSelect: vi.fn(),
      })
    );

    expect(markup).toContain("Develop CKD Progression Prediction Agent");
    expect(markup).toContain("2,500 AURA");
    expect(markup).toContain("Open");
  });
});

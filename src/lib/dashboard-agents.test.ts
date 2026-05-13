import { describe, expect, it } from "vitest";
import { getMobileOverviewAgents } from "./dashboard-agents";

const AGENTS = [
  { slug: "generalist", name: "Generalist" },
  { slug: "bloodwork", name: "Bloodwork" },
  { slug: "nutrition", name: "Nutrition" },
  { slug: "supplements", name: "Supplements" },
];

describe("getMobileOverviewAgents", () => {
  it("limits the mobile list to three favorites", () => {
    const result = getMobileOverviewAgents(AGENTS, [
      "generalist",
      "bloodwork",
      "nutrition",
      "supplements",
    ]);

    expect(result.map((agent) => agent.slug)).toEqual([
      "generalist",
      "bloodwork",
      "nutrition",
    ]);
  });

  it("keeps generalist pinned when available in the catalog", () => {
    const result = getMobileOverviewAgents(AGENTS, ["nutrition", "bloodwork"]);

    expect(result.map((agent) => agent.slug)).toEqual([
      "generalist",
      "nutrition",
      "bloodwork",
    ]);
  });

  it("filters out favorites that are missing from the catalog", () => {
    const result = getMobileOverviewAgents(AGENTS, [
      "generalist",
      "unknown",
      "bloodwork",
    ]);

    expect(result.map((agent) => agent.slug)).toEqual([
      "generalist",
      "bloodwork",
    ]);
  });

  it("keeps generalist first without duplicating it when favorites already include it", () => {
    const result = getMobileOverviewAgents(AGENTS, [
      "generalist",
      "generalist",
      "bloodwork",
    ]);

    expect(result.map((agent) => agent.slug)).toEqual([
      "generalist",
      "bloodwork",
    ]);
  });
});

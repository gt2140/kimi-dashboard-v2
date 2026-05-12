import { describe, expect, it } from "vitest";

import { bountySeedData } from "./data";
import {
  deriveBountySummary,
  filterAndSortBounties,
  getDeadlineTimestamp,
} from "./selectors";

describe("bounty selectors", () => {
  it("filters by status and sorts by reward descending", () => {
    const filtered = filterAndSortBounties(bountySeedData, {
      status: "Open",
      search: "",
      sortKey: "reward",
      sortDirection: "desc",
    });

    expect(filtered.map(bounty => bounty.id)).toEqual([6, 1, 2, 9, 5]);
  });

  it("searches across title, description, tags, requester, and type", () => {
    expect(
      filterAndSortBounties(bountySeedData, {
        status: "All",
        search: "latam",
        sortKey: "deadline",
        sortDirection: "asc",
      }).map(bounty => bounty.id)
    ).toEqual([2]);

    expect(
      filterAndSortBounties(bountySeedData, {
        status: "All",
        search: "hearttech",
        sortKey: "deadline",
        sortDirection: "asc",
      }).map(bounty => bounty.id)
    ).toEqual([5]);

    expect(
      filterAndSortBounties(bountySeedData, {
        status: "All",
        search: "p2p",
        sortKey: "deadline",
        sortDirection: "asc",
      }).map(bounty => bounty.id)
    ).toEqual([3, 7, 9, 5]);
  });

  it("sorts by deadline using parsed date order", () => {
    const filtered = filterAndSortBounties(bountySeedData, {
      status: "All",
      search: "",
      sortKey: "deadline",
      sortDirection: "asc",
    });

    expect(filtered.map(bounty => bounty.id).slice(0, 4)).toEqual([8, 10, 4, 3]);
    expect(getDeadlineTimestamp(filtered.at(-1)?.deadline ?? "")).toBeGreaterThan(
      getDeadlineTimestamp(filtered[0]?.deadline ?? "")
    );
  });

  it("derives the summary metrics for the dashboard cards", () => {
    expect(deriveBountySummary(bountySeedData)).toEqual({
      total: 10,
      active: 7,
      open: 5,
      underReview: 2,
      totalReward: 19350,
      totalSubmissions: 34,
    });
  });
});

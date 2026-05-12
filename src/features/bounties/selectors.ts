import type {
  Bounty,
  BountyFilterStatus,
  BountySortKey,
  SortDirection,
} from "./types";

export interface BountyQueryState {
  status: BountyFilterStatus;
  search: string;
  sortKey: BountySortKey;
  sortDirection: SortDirection;
}

export interface BountySummary {
  total: number;
  active: number;
  open: number;
  underReview: number;
  totalReward: number;
  totalSubmissions: number;
}

export function getDeadlineTimestamp(deadline: string) {
  const parsed = Date.parse(deadline);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

export function filterAndSortBounties(
  bounties: Bounty[],
  query: BountyQueryState
) {
  const normalizedQuery = query.search.trim().toLowerCase();

  return [...bounties]
    .filter(bounty => {
      if (query.status !== "All" && bounty.status !== query.status) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        bounty.title,
        bounty.description,
        bounty.type,
        bounty.requester,
        ...bounty.tags,
      ].some(field => field.toLowerCase().includes(normalizedQuery));
    })
    .sort((left, right) => {
      let comparison = 0;

      if (query.sortKey === "reward") {
        comparison = left.reward - right.reward;
      } else if (query.sortKey === "submissions") {
        comparison = left.submissions - right.submissions;
      } else {
        comparison =
          getDeadlineTimestamp(left.deadline) - getDeadlineTimestamp(right.deadline);
      }

      return query.sortDirection === "asc" ? comparison : -comparison;
    });
}

export function deriveBountySummary(bounties: Bounty[]): BountySummary {
  return {
    total: bounties.length,
    active: bounties.filter(
      bounty => bounty.status === "Open" || bounty.status === "In Progress"
    ).length,
    open: bounties.filter(bounty => bounty.status === "Open").length,
    underReview: bounties.filter(bounty => bounty.status === "Under Review").length,
    totalReward: bounties.reduce((sum, bounty) => sum + bounty.reward, 0),
    totalSubmissions: bounties.reduce(
      (sum, bounty) => sum + bounty.submissions,
      0
    ),
  };
}

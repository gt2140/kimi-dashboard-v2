export type BountyType = "Foundation" | "P2P";

export type BountyStatus =
  | "Open"
  | "In Progress"
  | "Under Review"
  | "Completed";

export type SubmissionStatus = "Pending" | "Accepted" | "Rejected";

export interface Submission {
  id: number;
  contributor: string;
  contributorAvatar: string;
  summary: string;
  status: SubmissionStatus;
  submittedAt: string;
}

export interface Bounty {
  id: number;
  title: string;
  description: string;
  fullDescription: string;
  type: BountyType;
  reward: number;
  status: BountyStatus;
  submissions: number;
  deadline: string;
  createdAt: string;
  requester: string;
  requesterAvatar: string;
  tags: string[];
  successCriteria: string;
  vaultContext?: string;
  submissionsList: Submission[];
}

export type BountyFilterStatus = "All" | BountyStatus;

export type BountySortKey = "reward" | "submissions" | "deadline";

export type SortDirection = "asc" | "desc";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { BountyStatus, BountyType, SubmissionStatus } from "../types";

const statusClassNames: Record<BountyStatus, string> = {
  Open: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  "In Progress": "border-sky-500/20 bg-sky-500/10 text-sky-300",
  "Under Review": "border-border bg-muted/40 text-muted-foreground",
  Completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};

const typeClassNames: Record<BountyType, string> = {
  Foundation: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  P2P: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
};

const submissionClassNames: Record<SubmissionStatus, string> = {
  Pending: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  Accepted: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Rejected: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

export function BountyStatusBadge({ status }: { status: BountyStatus }) {
  return (
    <Badge variant="outline" className={cn("border", statusClassNames[status])}>
      {status}
    </Badge>
  );
}

export function BountyTypeBadge({ type }: { type: BountyType }) {
  return (
    <Badge variant="outline" className={cn("border", typeClassNames[type])}>
      {type}
    </Badge>
  );
}

export function SubmissionStatusBadge({
  status,
}: {
  status: SubmissionStatus;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border", submissionClassNames[status])}
    >
      {status}
    </Badge>
  );
}

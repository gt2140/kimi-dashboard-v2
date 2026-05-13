import { ArrowUpRight, Clock3, Coins, Layers3, Search, Users2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import { BountyStatusBadge, BountyTypeBadge } from "./BountyBadges";
import type { Bounty } from "../types";

export function BountyTable({
  bounties,
  onSelect,
}: {
  bounties: Bounty[];
  onSelect: (bounty: Bounty) => void;
}) {
  if (bounties.length === 0) {
    return (
      <Card className="border-dashed border-border/40 bg-card/10">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
            <Search className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No mining found</p>
            <p className="mt-1 text-sm text-muted-foreground/55">
              Try another filter or search query.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2.5">
        <div className="hidden items-center justify-between rounded-2xl border border-border/25 bg-card/12 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/35 lg:flex">
          <span>Mining</span>
          <div className="flex items-center gap-6">
            <span>Type</span>
            <span>Reward</span>
            <span>Status</span>
            <span>Subs</span>
            <span>Deadline</span>
            <span>Action</span>
          </div>
        </div>

        {bounties.map(bounty => (
          <button
            key={bounty.id}
            onClick={() => onSelect(bounty)}
            className="w-full rounded-2xl border border-border/25 bg-card/14 px-3 py-3 text-left transition-colors hover:bg-card/22 sm:px-3.5"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <BountyTypeBadge type={bounty.type} />
                  <BountyStatusBadge status={bounty.status} />
                </div>
                <h3 className="mt-2 text-[14px] font-medium leading-snug text-foreground">
                  {bounty.title}
                </h3>
                <p className="mt-1 max-w-3xl text-[12px] leading-5 text-muted-foreground/58">
                  {bounty.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground/58 sm:flex sm:flex-wrap sm:items-center lg:max-w-[44%] lg:justify-end">
                <MetaInline
                  icon={<Layers3 className="h-3.5 w-3.5" />}
                  label={bounty.type}
                />
                <MetaInline
                  icon={<Coins className="h-3.5 w-3.5" />}
                  label={`${bounty.reward.toLocaleString()} AURA`}
                />
                <MetaInline
                  icon={<Users2 className="h-3.5 w-3.5" />}
                  label={`${bounty.submissions} submissions`}
                />
                <MetaInline
                  icon={<Clock3 className="h-3.5 w-3.5" />}
                  label={bounty.deadline}
                />
                <span className="inline-flex items-center justify-center gap-1 rounded-full border border-border/25 bg-background/40 px-2.5 py-1 text-[10px] font-medium text-foreground sm:justify-start">
                  Open
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function MetaInline({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/25 bg-background/28 px-2.5 py-1">
      {icon}
      {label}
    </span>
  );
}

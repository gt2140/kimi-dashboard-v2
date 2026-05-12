import { useMemo, useState } from "react";
import { Target } from "lucide-react";

import { bountySeedData } from "@/features/bounties/data";
import { BountyDetailDialog } from "@/features/bounties/components/BountyDetailDialog";
import { BountyFilters } from "@/features/bounties/components/BountyFilters";
import { BountySummaryCards } from "@/features/bounties/components/BountySummaryCards";
import { BountyTable } from "@/features/bounties/components/BountyTable";
import {
  deriveBountySummary,
  filterAndSortBounties,
} from "@/features/bounties/selectors";
import type {
  Bounty,
  BountyFilterStatus,
  BountySortKey,
  SortDirection,
} from "@/features/bounties/types";

export default function Bounties() {
  const [status, setStatus] = useState<BountyFilterStatus>("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<BountySortKey>("deadline");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);

  const summary = useMemo(() => deriveBountySummary(bountySeedData), []);
  const visibleBounties = useMemo(
    () =>
      filterAndSortBounties(bountySeedData, {
        status,
        search,
        sortKey,
        sortDirection,
      }),
    [search, sortDirection, sortKey, status]
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-muted-foreground/40">
              <Target className="h-4 w-4 text-amber-300" />
              <span>Bounties</span>
            </div>
            <h1 className="mt-3 text-[24px] font-medium tracking-tight text-foreground">
              Explore active reward opportunities
            </h1>
            <p className="mt-2 text-[13px] leading-7 text-muted-foreground/55">
              Browse foundation and peer-to-peer bounties inside Aura, inspect
              the brief and success criteria, and see where reward flow is
              concentrating before we connect the live backend.
            </p>
          </div>
          <div className="rounded-xl border border-border/30 bg-card/20 px-4 py-3 text-sm text-muted-foreground/60">
            Local seeded data, prepared for backend swap later.
          </div>
        </header>

        <BountySummaryCards summary={summary} />

        <BountyFilters
          status={status}
          search={search}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onStatusChange={setStatus}
          onSearchChange={setSearch}
          onSortKeyChange={setSortKey}
          onSortDirectionChange={setSortDirection}
        />

        <BountyTable bounties={visibleBounties} onSelect={setSelectedBounty} />
      </div>

      <BountyDetailDialog
        bounty={selectedBounty}
        open={selectedBounty !== null}
        onOpenChange={open => {
          if (!open) {
            setSelectedBounty(null);
          }
        }}
      />
    </div>
  );
}

import { useMemo, useState } from "react";
import { Plus, Target } from "lucide-react";

import { bountySeedData } from "@/features/bounties/data";
import { CreateP2PDialog } from "@/features/bounties/components/CreateP2PDialog";
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
  const [isCreateP2POpen, setIsCreateP2POpen] = useState(false);

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
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-muted-foreground/40">
              <Target className="h-4 w-4 text-cyan-300" />
              <span>Mining</span>
            </div>
            <h1 className="mt-2.5 text-[22px] font-medium tracking-tight text-foreground sm:text-[24px]">
              Explore active mining opportunities
            </h1>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-muted-foreground/55 sm:text-[13px] sm:leading-6">
              A tighter marketplace surface for foundation and peer-to-peer work
              inside Aura.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={() => setIsCreateP2POpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-500/15"
            >
              <Plus className="h-4 w-4" />
              Create P2P
            </button>
            <div className="rounded-xl border border-border/30 bg-card/20 px-3.5 py-2 text-[11px] text-muted-foreground/55 sm:text-sm">
              Local seeded data, ready for a backend swap later.
            </div>
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
      <CreateP2PDialog
        open={isCreateP2POpen}
        onOpenChange={setIsCreateP2POpen}
      />
    </div>
  );
}

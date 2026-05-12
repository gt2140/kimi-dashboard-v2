import { ArrowUpRight, Clock3, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
            <p className="text-sm font-medium text-foreground">No bounties found</p>
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
      <div className="hidden lg:block">
        <Card className="border-border/30 bg-card/20">
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Bounty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subs</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="pr-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bounties.map(bounty => (
                  <TableRow
                    key={bounty.id}
                    className="cursor-pointer border-border/30"
                    onClick={() => onSelect(bounty)}
                  >
                    <TableCell className="pl-6">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {bounty.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground/55">
                          {bounty.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BountyTypeBadge type={bounty.type} />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {bounty.reward.toLocaleString()} AURA
                    </TableCell>
                    <TableCell>
                      <BountyStatusBadge status={bounty.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground/70">
                      {bounty.submissions}
                    </TableCell>
                    <TableCell className="text-muted-foreground/70">
                      {bounty.deadline}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={event => {
                          event.stopPropagation();
                          onSelect(bounty);
                        }}
                      >
                        View
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:hidden">
        {bounties.map(bounty => (
          <button
            key={bounty.id}
            onClick={() => onSelect(bounty)}
            className="rounded-xl border border-border/40 bg-card/20 p-4 text-left transition-colors hover:bg-card/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              <BountyTypeBadge type={bounty.type} />
              <BountyStatusBadge status={bounty.status} />
            </div>
            <h3 className="mt-3 text-sm font-medium text-foreground">
              {bounty.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground/65">
              {bounty.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground/55">
              <span>{bounty.reward.toLocaleString()} AURA</span>
              <span>{bounty.submissions} submissions</span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" />
                {bounty.deadline}
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

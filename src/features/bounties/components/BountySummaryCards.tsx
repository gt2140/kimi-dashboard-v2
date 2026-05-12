import { Activity, Coins, FolderClock, SearchCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { BountySummary } from "../selectors";

export function BountySummaryCards({ summary }: { summary: BountySummary }) {
  const cards = [
    {
      label: "Active bounties",
      value: summary.active.toString(),
      note: `${summary.open} currently open`,
      icon: <Activity className="h-4 w-4 text-amber-300" />,
    },
    {
      label: "Total rewards",
      value: `${summary.totalReward.toLocaleString()} AURA`,
      note: `${summary.total} total opportunities`,
      icon: <Coins className="h-4 w-4 text-cyan-300" />,
    },
    {
      label: "Under review",
      value: summary.underReview.toString(),
      note: "Awaiting evaluation",
      icon: <SearchCheck className="h-4 w-4 text-sky-300" />,
    },
    {
      label: "Total submissions",
      value: summary.totalSubmissions.toString(),
      note: "Across all seeded bounties",
      icon: <FolderClock className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <Card key={card.label} className="border-border/40 bg-card/20">
          <CardHeader className="gap-1">
            <div className="flex items-center justify-between gap-3">
              <CardDescription className="text-[11px] uppercase tracking-wider text-muted-foreground/40">
                {card.label}
              </CardDescription>
              {card.icon}
            </div>
            <CardTitle className="text-2xl font-medium tracking-tight">
              {card.value}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[12px] text-muted-foreground/45">{card.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { Activity, Coins, FolderClock, SearchCheck } from "lucide-react";

import type { BountySummary } from "../selectors";

export function BountySummaryCards({ summary }: { summary: BountySummary }) {
  const cards = [
    {
      label: "Active mining",
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
      note: "Across all seeded mining",
      icon: <FolderClock className="h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      {cards.map(card => (
        <div
          key={card.label}
          className="rounded-2xl border border-border/30 bg-card/18 px-3.5 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.1)]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/34">
              {card.label}
            </p>
            {card.icon}
          </div>
          <div className="mt-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-[17px] font-medium tracking-tight text-foreground sm:text-[20px]">
              {card.value}
            </p>
            <p className="max-w-[8rem] text-left text-[10px] leading-4 text-muted-foreground/42 sm:text-right">
              {card.note}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

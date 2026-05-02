import { NavLink } from "react-router";
import { BrainCircuit, DatabaseZap, MessageSquareCode } from "lucide-react";
import { cn } from "@/lib/utils";

const kimiTabs = [
  {
    to: "/kimi/chat",
    label: "Kimi Chat",
    icon: MessageSquareCode,
  },
  {
    to: "/kimi/agents",
    label: "Kimi Agents",
    icon: BrainCircuit,
  },
  {
    to: "/kimi/vault",
    label: "Kimi Vault",
    icon: DatabaseZap,
  },
];

export function KimiHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-4 space-y-3 sm:mb-5">
      <div className="overflow-hidden rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_35%),linear-gradient(180deg,rgba(20,20,25,0.95),rgba(12,12,16,0.92))] px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-amber-200/60">
              Aura Kimi
            </p>
            <h1 className="mt-1 truncate text-[20px] font-medium tracking-tight text-white sm:text-[24px]">
              {title}
            </h1>
          </div>
          {description ? (
            <div className="hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/55 lg:block">
              {description}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {kimiTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition-colors sm:text-[12px]",
                  isActive
                    ? "border-amber-300/35 bg-amber-400/10 text-amber-100"
                    : "border-border/30 bg-card/25 text-muted-foreground/50 hover:text-foreground",
                )
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

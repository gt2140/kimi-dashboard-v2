import { NavLink } from "react-router";
import { BrainCircuit, DatabaseZap, MessageSquareCode } from "lucide-react";
import { cn } from "@/lib/utils";

const kimiTabs = [
  {
    to: "/kimi/chat",
    label: "Chat",
    icon: MessageSquareCode,
  },
  {
    to: "/kimi/agents",
    label: "Agents",
    icon: BrainCircuit,
  },
  {
    to: "/kimi/vault",
    label: "Vault",
    icon: DatabaseZap,
  },
];

export function KimiHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 space-y-4">
      <div className="overflow-hidden rounded-3xl border border-border/40 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_32%),linear-gradient(180deg,rgba(20,20,25,0.95),rgba(12,12,16,0.92))] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-amber-200/65">
              Aura Workspace
            </p>
            <h1 className="mt-2 text-[24px] font-medium tracking-tight text-white sm:text-[28px]">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/60 sm:text-[13px]">
              {description}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/60">
            Multi-model workspace
            <div className="mt-1 text-[14px] font-medium text-white">
              Chat, agents, and vault context
            </div>
          </div>
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
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] transition-colors",
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

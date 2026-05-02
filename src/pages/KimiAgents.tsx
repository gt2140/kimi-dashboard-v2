import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Brain, DatabaseZap, Search, Settings2, Sparkles, Text } from "lucide-react";
import { KimiHeader } from "@/components/kimi/KimiHeader";
import { Input } from "@/components/ui/input";
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { useChatStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

export default function KimiAgents() {
  const navigate = useNavigate();
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const { agents, userSettings, error } = useAgentCatalog();
  const [search, setSearch] = useState("");

  const settingsBySlug = useMemo(
    () => new Map(userSettings.map(setting => [setting.agent.slug, setting])),
    [userSettings],
  );

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        agent =>
          agent.name.toLowerCase().includes(search.toLowerCase()) ||
          agent.description.toLowerCase().includes(search.toLowerCase()),
      ),
    [agents, search],
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <KimiHeader title="Kimi Agents" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
        <Input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search agents..."
          className="h-9 border-border/30 bg-card/30 pl-9 text-[12px]"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {filteredAgents.map(agent => {
          const setting = settingsBySlug.get(agent.slug);
          const toggles = [
            setting?.preferKimiMemory === false ? "Aura memory" : "Kimi memory",
            setting?.allowVaultContext === false ? "Vault off" : "Vault on",
            setting?.allowWebResearch === false ? "Web off" : "Web on",
          ];

          return (
            <div
              key={agent.slug}
              className="rounded-3xl border border-border/35 bg-card/20 p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("text-[11px] uppercase tracking-[0.2em] text-muted-foreground/35", agent.color ?? "")}>
                    {agent.slug}
                  </p>
                  <h2 className="mt-1 truncate text-[16px] font-medium text-foreground">
                    {agent.name}
                  </h2>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/45">
                    {agent.description}
                  </p>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-amber-200/70" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill icon={<Brain className="h-3 w-3" />}>
                  thinking {setting?.kimiThinkingMode ?? "enabled"}
                </Pill>
                <Pill icon={<Text className="h-3 w-3" />}>
                  {setting?.responseStyle ?? "detailed"} style
                </Pill>
                {toggles.map(toggle => (
                  <Pill key={toggle} icon={<DatabaseZap className="h-3 w-3" />}>
                    {toggle}
                  </Pill>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => {
                    setActiveAgent(agent.slug);
                    navigate("/kimi/chat");
                  }}
                  className="flex flex-1 items-center justify-center gap-1 rounded-full bg-foreground/6 px-3 py-2.5 text-[11px] text-foreground transition-colors hover:bg-foreground/10"
                >
                  Chat
                </button>
                <button
                  onClick={() => navigate(`/kimi/agents/${agent.slug}`)}
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-border/30 px-3 py-2.5 text-[11px] text-muted-foreground/55 transition-colors hover:text-foreground"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Settings
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-[12px] text-destructive/80">{error}</p>}
    </div>
  );
}

function Pill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/25 bg-background/40 px-2.5 py-1 text-[10px] text-muted-foreground/55">
      {icon}
      {children}
    </span>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Brain,
  DatabaseZap,
  Globe,
  Heart,
  Pin,
  Search,
  Settings2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { useChatStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

export default function KimiAgents() {
  const navigate = useNavigate();
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const { agents, userSettings, favoriteAgentIds, saveUserSettings, error } =
    useAgentCatalog();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "favorites" | "web">("all");

  const settingsBySlug = useMemo(
    () =>
      new Map(
        userSettings.map(setting => [
          setting.agent.slug,
          setting,
        ]),
      ),
    [userSettings],
  );

  const agentsWithState = useMemo(
    () =>
      agents.map(agent => {
        const setting = settingsBySlug.get(agent.slug);
        const isFavorite = favoriteAgentIds.includes(agent.slug);
        const isPinned = agent.slug === "generalist";
        const tools = Array.from(
          new Set([
            ...(setting?.preferKimiMemory ? ["memory"] : []),
            ...(setting?.allowWebResearch ? ["web-search"] : []),
            ...(setting?.allowScientificResearch ? ["rethink"] : []),
            ...((setting?.enabledFormulaTools as string[] | undefined) ?? []),
          ]),
        );

        return {
          agent,
          setting,
          isFavorite,
          isPinned,
          tools,
        };
      }),
    [agents, favoriteAgentIds, settingsBySlug],
  );

  const filteredAgents = useMemo(() => {
    const query = search.toLowerCase().trim();

    return agentsWithState.filter(({ agent, setting, isFavorite, isPinned }) => {
      const matchesQuery =
        query.length === 0 ||
        agent.name.toLowerCase().includes(query) ||
        agent.slug.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query);

      if (!matchesQuery) {
        return false;
      }

      if (viewMode === "favorites") {
        return isFavorite || isPinned;
      }

      if (viewMode === "web") {
        return Boolean(setting?.allowWebResearch);
      }

      return true;
    });
  }, [agentsWithState, search, viewMode]);

  const featuredAgents = useMemo(
    () => filteredAgents.filter(({ isFavorite, isPinned }) => isFavorite || isPinned),
    [filteredAgents],
  );

  const catalogAgents = useMemo(
    () => filteredAgents.filter(({ isFavorite, isPinned }) => !isFavorite && !isPinned),
    [filteredAgents],
  );

  return (
    <div className="mx-auto w-full max-w-[1480px] min-w-0 p-3 sm:p-4 lg:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/35">
            Agents
          </p>
          <h1 className="mt-1 text-[22px] font-medium tracking-tight text-foreground">
            Favorite agents, memory, and tools
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-5 text-muted-foreground/45">
            Keep your core agents close, then fine-tune how each one uses
            memory, web search, and vault context.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 lg:max-w-[520px]">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search agents..."
              className="h-10 border-border/30 bg-card/30 pl-9 text-[12px]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              active={viewMode === "all"}
              onClick={() => setViewMode("all")}
            >
              All
            </FilterChip>
            <FilterChip
              active={viewMode === "favorites"}
              onClick={() => setViewMode("favorites")}
            >
              Favorites
            </FilterChip>
            <FilterChip
              active={viewMode === "web"}
              onClick={() => setViewMode("web")}
            >
              Web on
            </FilterChip>
          </div>
        </div>
      </div>

      {featuredAgents.length > 0 ? (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/35">
                Pinned and favorites
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground/42">
                Your primary workspace layer for fast switching.
              </p>
            </div>
            <span className="rounded-full border border-border/25 bg-background/30 px-2.5 py-1 text-[10px] text-muted-foreground/45">
              {featuredAgents.length} active
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {featuredAgents.map(item => (
              <FeaturedAgentCard
                key={item.agent.slug}
                agent={item.agent}
                setting={item.setting}
                tools={item.tools}
                isFavorite={item.isFavorite}
                isPinned={item.isPinned}
                onToggleFavorite={() => {
                  if (item.isPinned) {
                    return;
                  }
                  void saveUserSettings({
                    slug: item.agent.slug,
                    isFavorite: !item.isFavorite,
                  });
                }}
                onChat={() => {
                  setActiveAgent(item.agent.slug);
                  navigate("/kimi/chat");
                }}
                onSettings={() => navigate(`/kimi/agents/${item.agent.slug}`)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/35">
              Agent catalog
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground/42">
              Browse the full roster and pin the ones you want close.
            </p>
          </div>
          <span className="rounded-full border border-border/25 bg-background/30 px-2.5 py-1 text-[10px] text-muted-foreground/45">
            {catalogAgents.length} visible
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {catalogAgents.map(item => (
            <CatalogAgentCard
              key={item.agent.slug}
              agent={item.agent}
              setting={item.setting}
              tools={item.tools}
              isFavorite={item.isFavorite}
              isPinned={item.isPinned}
              onToggleFavorite={() => {
                if (item.isPinned) {
                  return;
                }
                void saveUserSettings({
                  slug: item.agent.slug,
                  isFavorite: !item.isFavorite,
                });
              }}
              onChat={() => {
                setActiveAgent(item.agent.slug);
                navigate("/kimi/chat");
              }}
              onSettings={() => navigate(`/kimi/agents/${item.agent.slug}`)}
            />
          ))}
        </div>
      </section>

      {error && (
        <p className="mt-4 text-[12px] text-destructive/80">{error}</p>
      )}
    </div>
  );
}

function FeaturedAgentCard({
  agent,
  setting,
  tools,
  isFavorite,
  isPinned,
  onToggleFavorite,
  onChat,
  onSettings,
}: AgentCardProps) {
  return (
    <div className="rounded-[28px] border border-border/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-300/80" />
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/38">
              {agent.slug.replaceAll("-", " ")}
            </p>
          </div>
          <h2 className="mt-2 text-[18px] font-medium tracking-tight text-foreground">
            {agent.name}
          </h2>
          <p className="mt-1 line-clamp-2 max-w-[32rem] text-[12px] leading-5 text-muted-foreground/50">
            {agent.description}
          </p>
        </div>
        <FavoriteToggle
          isFavorite={isFavorite}
          isPinned={isPinned}
          onClick={onToggleFavorite}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <MetaPill icon={<Brain className="h-3 w-3" />}>
          Thinking {setting?.kimiThinkingMode ?? "enabled"}
        </MetaPill>
        <MetaPill icon={<DatabaseZap className="h-3 w-3" />}>
          {setting?.preferKimiMemory === false ? "Aura memory" : "Primary memory"}
        </MetaPill>
        <MetaPill icon={<Globe className="h-3 w-3" />}>
          {setting?.allowWebResearch ? "Web on" : "Web off"}
        </MetaPill>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border/20 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/32">
            Tools
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground/52">
            {describeTools(tools)}
          </p>
        </div>
        <div className="flex w-full gap-1.5 sm:w-auto">
          <button
            onClick={onChat}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-foreground px-4 text-[11px] font-medium text-background transition-opacity hover:opacity-90 sm:flex-none"
          >
            Chat
          </button>
          <button
            onClick={onSettings}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full border border-border/25 px-3 text-[11px] text-muted-foreground/58 transition-colors hover:text-foreground sm:flex-none"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function CatalogAgentCard({
  agent,
  setting,
  tools,
  isFavorite,
  isPinned,
  onToggleFavorite,
  onChat,
  onSettings,
}: AgentCardProps) {
  return (
    <div className="rounded-3xl border border-border/25 bg-card/16 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/30">
            {agent.slug.replaceAll("-", " ")}
          </p>
          <h3 className="mt-1.5 text-[15px] font-medium text-foreground">{agent.name}</h3>
          <p className="mt-1 line-clamp-1 text-[11px] leading-5 text-muted-foreground/44">
            {agent.description}
          </p>
        </div>
        <FavoriteToggle
          isFavorite={isFavorite}
          isPinned={isPinned}
          onClick={onToggleFavorite}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <MetaPill icon={<Brain className="h-3 w-3" />}>
          {setting?.kimiThinkingMode ?? "enabled"}
        </MetaPill>
        <MetaPill icon={<DatabaseZap className="h-3 w-3" />}>
          {setting?.preferKimiMemory === false ? "Aura" : "Primary"}
        </MetaPill>
        <MetaPill icon={<Globe className="h-3 w-3" />}>
          {setting?.allowWebResearch ? "Web on" : "Web off"}
        </MetaPill>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground/44">{describeTools(tools)}</p>
        <div className="flex w-full gap-1.5 sm:w-auto">
          <button
            onClick={onChat}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-foreground/7 px-3 text-[10px] font-medium text-foreground transition-colors hover:bg-foreground/11 sm:flex-none"
          >
            Chat
          </button>
          <button
            onClick={onSettings}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-full border border-border/25 px-2.5 text-[10px] text-muted-foreground/55 transition-colors hover:text-foreground sm:flex-none"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </button>
        </div>
      </div>
    </div>
  );
}

type AgentCardProps = {
  agent: {
    slug: string;
    name: string;
    description: string;
    color?: string | null;
  };
  setting: {
    kimiThinkingMode?: string | null;
    preferKimiMemory?: boolean | null;
    allowWebResearch?: boolean | null;
  } | undefined;
  tools: string[];
  isFavorite: boolean;
  isPinned: boolean;
  onToggleFavorite: () => void;
  onChat: () => void;
  onSettings: () => void;
};

function FavoriteToggle({
  isFavorite,
  isPinned,
  onClick,
}: {
  isFavorite: boolean;
  isPinned: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isPinned}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[10px] transition-colors",
        isFavorite
          ? "border-rose-300/30 bg-rose-400/10 text-rose-200"
          : "border-border/25 bg-background/25 text-muted-foreground/46 hover:text-foreground",
        isPinned && "cursor-default border-amber-300/25 bg-amber-400/10 text-amber-100",
      )}
      title={isPinned ? "Generalist always stays pinned" : undefined}
    >
      {isPinned ? (
        <Pin className="h-3 w-3" />
      ) : (
        <Heart className={cn("h-3 w-3", isFavorite && "fill-current")} />
      )}
      {isPinned ? "Pinned" : isFavorite ? "Favorite" : "Save"}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-[11px] transition-colors",
        active
          ? "border-cyan-300/25 bg-cyan-400/10 text-cyan-100"
          : "border-border/25 bg-background/25 text-muted-foreground/45 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function MetaPill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/22 bg-background/30 px-2.5 py-1 text-[10px] text-muted-foreground/54">
      {icon}
      {children}
    </span>
  );
}

function describeTools(tools: string[]) {
  if (tools.length === 0) {
    return "No extra tools configured";
  }

  if (tools.length === 1) {
    return `1 tool enabled`;
  }

  return `${tools.length} tools enabled`;
}

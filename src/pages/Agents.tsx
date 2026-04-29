import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  Activity,
  Apple,
  ArrowUpRight,
  Beaker,
  BookOpen,
  Brain,
  Cog,
  Dna,
  Droplets,
  Flower2,
  Gauge,
  Heart,
  HeartPulse,
  Hourglass,
  Moon,
  Pill,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  Venus,
  Zap,
} from "lucide-react";
import { useChatStore } from "@/hooks/useStore";
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const allIcons: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-5 w-5" />,
  Droplets: <Droplets className="h-5 w-5" />,
  Apple: <Apple className="h-5 w-5" />,
  Pill: <Pill className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  Flower2: <Flower2 className="h-5 w-5" />,
  Moon: <Moon className="h-5 w-5" />,
  Hourglass: <Hourglass className="h-5 w-5" />,
  HeartPulse: <HeartPulse className="h-5 w-5" />,
  Beaker: <Beaker className="h-5 w-5" />,
  Venus: <Venus className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
  BookOpen: <BookOpen className="h-5 w-5" />,
  Stethoscope: <Stethoscope className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  Target: <Target className="h-5 w-5" />,
  Dna: <Dna className="h-5 w-5" />,
  ShieldAlert: <ShieldAlert className="h-5 w-5" />,
  Gauge: <Gauge className="h-5 w-5" />,
  Activity: <Activity className="h-5 w-5" />,
};

export default function Agents() {
  const navigate = useNavigate();
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const { agents, favoriteAgentIds, favoriteAgents, saveUserSettings, error } =
    useAgentCatalog();
  const [tab, setTab] = useState<"favorites" | "marketplace">("favorites");
  const [search, setSearch] = useState("");

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        agent =>
          agent.name.toLowerCase().includes(search.toLowerCase()) ||
          agent.description.toLowerCase().includes(search.toLowerCase()) ||
          agent.tags?.some(tag =>
            tag.toLowerCase().includes(search.toLowerCase())
          )
      ),
    [agents, search]
  );

  const filteredFavoriteAgents = favoriteAgents.filter(
    agent =>
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.description.toLowerCase().includes(search.toLowerCase()) ||
      agent.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[20px] font-medium tracking-tight text-foreground">
          Agents
        </h1>
        <p className="mt-1 text-[12px] text-muted-foreground/40">
          All agents live in the marketplace. Your left sidebar only shows the
          ones you marked as favorites, with Generalist always pinned.
        </p>
      </motion.div>

      <div className="mt-6 relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="h-8 border-border/30 bg-card/30 pl-8 text-[12px]"
        />
      </div>

      <div className="mt-6 flex w-fit gap-1 rounded-lg bg-muted/30 p-1">
        <button
          onClick={() => setTab("favorites")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[12px] font-medium transition-all",
            tab === "favorites"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground/40 hover:text-muted-foreground/60"
          )}
        >
          Favorites ({filteredFavoriteAgents.length})
        </button>
        <button
          onClick={() => setTab("marketplace")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[12px] font-medium transition-all",
            tab === "marketplace"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground/40 hover:text-muted-foreground/60"
          )}
        >
          Marketplace ({filteredAgents.length})
        </button>
      </div>

      {tab === "favorites" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Favorite agents
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground/35">
                These are the agents that appear automatically in the left
                sidebar.
              </p>
            </div>
          </div>

          {filteredFavoriteAgents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/40 bg-card/20 p-6 text-[12px] text-muted-foreground/40">
              No favorites match this search yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredFavoriteAgents.map(agent => (
                <AgentCard
                  key={agent.slug}
                  agent={agent}
                  isFavorite={favoriteAgentIds.includes(agent.slug)}
                  onToggleFavorite={() => {
                    void saveUserSettings({
                      slug: agent.slug,
                      isFavorite: !favoriteAgentIds.includes(agent.slug),
                    });
                  }}
                  onStartChat={() => {
                    setActiveAgent(agent.slug);
                    navigate("/chat");
                  }}
                  onOpenSettings={() => navigate(`/agents/${agent.slug}`)}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {tab === "marketplace" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
          <div className="mb-3">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Marketplace agents
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground/35">
              Mark agents as favorites to surface them in the sidebar, or open
              settings to prepare their training and context.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map(agent => (
              <AgentCard
                key={agent.slug}
                agent={agent}
                isFavorite={favoriteAgentIds.includes(agent.slug)}
                onToggleFavorite={() => {
                  void saveUserSettings({
                    slug: agent.slug,
                    isFavorite: !favoriteAgentIds.includes(agent.slug),
                  });
                }}
                onStartChat={() => {
                  setActiveAgent(agent.slug);
                  navigate("/chat");
                }}
                onOpenSettings={() => navigate(`/agents/${agent.slug}`)}
              />
            ))}
          </div>
        </motion.div>
      )}

      {error && (
        <p className="mt-4 text-[12px] text-destructive/80">{error}</p>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  isFavorite,
  onToggleFavorite,
  onStartChat,
  onOpenSettings,
}: {
  agent: {
    slug: string;
    name: string;
    description: string;
    icon: string;
    color: string | null;
    installs: number;
    author: string | null;
    rating: string | null;
    tags: string[];
    allowedVaultCategories: string[];
  };
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onStartChat: () => void;
  onOpenSettings: () => void;
}) {
  const isPinnedGeneralist = agent.slug === "generalist";

  return (
    <div className="group rounded-xl border border-border/30 bg-card/20 p-4 transition-all hover:border-border/50 hover:bg-card/40">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40", agent.color ?? "text-foreground/60")}>
          {allIcons[agent.icon] ?? <Sparkles className="h-5 w-5" />}
        </div>
        <div className="flex items-center gap-2">
          {agent.rating && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
              <Star className="h-3 w-3" /> {agent.rating}
            </div>
          )}
          <button
            onClick={onToggleFavorite}
            disabled={isPinnedGeneralist}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors",
              isFavorite
                ? "border-rose-300/40 bg-rose-400/10 text-rose-200"
                : "border-border/30 bg-card/30 text-muted-foreground/40 hover:text-foreground",
              isPinnedGeneralist && "cursor-default"
            )}
            title={isPinnedGeneralist ? "Generalist is always pinned" : undefined}
          >
            <Heart className={cn("h-3 w-3", isFavorite && "fill-current")} />
            {isPinnedGeneralist ? "Pinned" : isFavorite ? "Favorite" : "Save"}
          </button>
        </div>
      </div>

      <h3 className="mt-3 text-[14px] font-medium text-foreground">{agent.name}</h3>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/40">
        {agent.description}
      </p>

      {(agent.installs || agent.author) && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/30">
          {agent.installs && (
            <span className="flex items-center gap-1">
              <Users className="h-2.5 w-2.5" />
              {agent.installs.toLocaleString()}
            </span>
          )}
          {agent.author && <span>by {agent.author}</span>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1">
        {agent.allowedVaultCategories.map(category => (
          <span
            key={category}
            className="rounded-full border border-border/20 bg-muted/30 px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground/40"
          >
            {category}
          </span>
        ))}
      </div>

      {agent.tags && agent.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.tags.map(tag => (
            <span
              key={tag}
              className="rounded-full border border-border/20 bg-muted/20 px-1.5 py-0.5 text-[9px] text-muted-foreground/35"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={onStartChat}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-foreground/5 py-1.5 text-[11px] text-foreground transition-colors hover:bg-foreground/10"
        >
          Start chat <ArrowUpRight className="h-3 w-3" />
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center gap-1 rounded-md border border-border/30 px-3 py-1.5 text-[11px] text-muted-foreground/55 transition-colors hover:border-border/50 hover:text-foreground"
        >
          <Cog className="h-3 w-3" />
          Settings
        </button>
      </div>
    </div>
  );
}

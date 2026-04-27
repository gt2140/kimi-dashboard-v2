import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  Brain, Droplets, Apple, Pill, Sparkles, Flower2,
  Moon, Hourglass, HeartPulse, Beaker, Venus, Zap,
  BookOpen, Stethoscope, TrendingUp, Target, Dna,
  ShieldAlert, Gauge, Activity, ArrowUpRight, Star,
  Users, Settings, Plus,
  Search
} from "lucide-react";
import { useChatStore } from "@/hooks/useStore";
import { BUILT_IN_AGENTS, MARKETPLACE_AGENTS } from "@/lib/data";
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
  const setActiveAgent = useChatStore((state) => state.setActiveAgent);
  const [tab, setTab] = useState<"my" | "marketplace">("my");
  const [search, setSearch] = useState("");

  const filteredMarketplace = MARKETPLACE_AGENTS.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase()) ||
    a.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredBuiltIn = BUILT_IN_AGENTS.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[20px] font-medium tracking-tight text-foreground">Agents</h1>
        <p className="text-[12px] text-muted-foreground/40 mt-1">Your health intelligence team and community agents</p>
      </motion.div>

      {/* Search */}
      <div className="mt-6 relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/25" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agents..." className="h-8 pl-8 text-[12px] bg-card/30 border-border/30" />
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 p-1 rounded-lg bg-muted/30 w-fit">
        <button onClick={() => setTab("my")} className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-all", tab === "my" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground/60")}>My Agents ({filteredBuiltIn.length})</button>
        <button onClick={() => setTab("marketplace")} className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-all", tab === "marketplace" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground/60")}>Marketplace ({filteredMarketplace.length})</button>
      </div>

      {/* My Agents */}
      {tab === "my" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
          <div className="mb-3">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">Built-in agents</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredBuiltIn.map((agent) => (
              <div key={agent.id} className="group rounded-xl border border-border/30 bg-card/20 p-4 transition-all hover:bg-card/40 hover:border-border/50">
                <div className="flex items-start justify-between">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40", agent.color)}>
                    {allIcons[agent.icon]}
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => navigate(`/agents/${agent.id}`)} className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"><Settings className="h-3 w-3" /> Settings</button>
                  </div>
                </div>
                <h3 className="mt-3 text-[14px] font-medium text-foreground">{agent.name}</h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/40">{agent.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {agent.allowedVaultCategories.map((cat) => (
                    <span key={cat} className="px-1.5 py-0.5 rounded-full bg-muted/30 text-[9px] text-muted-foreground/40 border border-border/20 uppercase">{cat}</span>
                  ))}
                </div>
                <button onClick={() => { setActiveAgent(agent.id); navigate("/chat"); }} className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors">
                  Start chat <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Marketplace */}
      {tab === "marketplace" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
          <div className="mb-3">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">Community agents</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredMarketplace.map((agent) => (
              <div key={agent.id} className="group rounded-xl border border-border/30 bg-card/20 p-4 transition-all hover:bg-card/40 hover:border-border/50">
                <div className="flex items-start justify-between">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40", agent.color)}>
                    {allIcons[agent.icon]}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/30">
                    <Star className="h-3 w-3" /> {agent.rating}
                  </div>
                </div>
                <h3 className="mt-3 text-[14px] font-medium text-foreground">{agent.name}</h3>
                <p className="text-[11px] text-muted-foreground/40 mt-0.5">{agent.description}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/30">
                  <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {agent.installs?.toLocaleString()}</span>
                  <span>by {agent.author}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {agent.tags?.map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 rounded-full bg-muted/30 text-[9px] text-muted-foreground/40 border border-border/20">{tag}</span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => { setActiveAgent(agent.id); navigate("/chat"); }} className="flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-[11px] bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors">
                    <Plus className="h-3 w-3" /> Add & Chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

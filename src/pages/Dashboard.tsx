import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  Brain, Droplets, Apple, Pill, Sparkles, Flower2,
  ArrowUpRight, FileText, Zap, TrendingUp, Trophy, FlaskConical
} from "lucide-react";
import { useChatStore } from "@/hooks/useStore";
import { BUILT_IN_AGENTS, MOCK_VAULT_FILES } from "@/lib/data";
import { usePredictionsStore } from "@/hooks/useStore";
import { useProfileStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-5 w-5" />,
  Droplets: <Droplets className="h-5 w-5" />,
  Apple: <Apple className="h-5 w-5" />,
  Pill: <Pill className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  Flower2: <Flower2 className="h-5 w-5" />,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const setActiveAgent = useChatStore((state) => state.setActiveAgent);
  const predictions = usePredictionsStore((s) => s.predictions);
  const balance = useProfileStore((s) => s.balance);
  const recentFiles = MOCK_VAULT_FILES.slice(0, 5);
  const openPredictions = predictions.filter((p) => p.status === "open");

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-baseline justify-between">
          <h1 className="text-[20px] font-medium tracking-tight text-foreground">Overview</h1>
          <span className="text-[12px] text-muted-foreground/40">{balance.aura.toLocaleString()} AURA</span>
        </div>
      </motion.div>

      {/* Agent Cards - solid grid */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">My Agents</h2>
          <button onClick={() => navigate("/agents")} className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors flex items-center gap-1">
            All agents <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
          {BUILT_IN_AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => { setActiveAgent(agent.id); navigate("/chat"); }}
              className="group flex items-center gap-3 rounded-xl border border-border/40 bg-card/20 px-4 py-3 text-left transition-all hover:bg-card/50 hover:border-border/70 min-w-0"
            >
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 transition-colors", agent.color)}>
                {iconMap[agent.icon]}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="text-[13px] font-medium text-foreground truncate">{agent.name}</p>
                <p className="text-[11px] text-muted-foreground/40 truncate">{agent.description}</p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/15 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<FileText className="h-4 w-4" />} label="Vault files" value={MOCK_VAULT_FILES.length} onClick={() => navigate("/vault")} />
        <StatCard icon={<Zap className="h-4 w-4" />} label="Active agents" value={BUILT_IN_AGENTS.length + 16} onClick={() => navigate("/agents")} />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Open predictions" value={openPredictions.length} onClick={() => navigate("/predictions")} />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Tokens earned" value={balance.earned} onClick={() => navigate("/profile")} />
      </motion.div>

      {/* Two Column - responsive */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Vault */}
        <div className="rounded-xl border border-border/30 bg-card/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">Recent uploads</h2>
            <button onClick={() => navigate("/vault")} className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors">View all</button>
          </div>
          <div className="space-y-0.5">
            {recentFiles.map((file) => (
              <button key={file.id} onClick={() => navigate("/vault")} className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-card/40 group">
                <FileText className="h-3.5 w-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/40 transition-colors shrink-0" />
                <span className="text-[12px] text-foreground truncate">{file.filename}</span>
                <span className="ml-auto text-[11px] text-muted-foreground/25 uppercase shrink-0">{file.category}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Open Predictions */}
        <div className="rounded-xl border border-border/30 bg-card/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">Live predictions</h2>
            <button onClick={() => navigate("/predictions")} className="text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors">View all</button>
          </div>
          <div className="space-y-0.5">
            {openPredictions.slice(0, 4).map((pred) => (
              <button key={pred.id} onClick={() => navigate("/predictions")} className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-card/40 group">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                  <FlaskConical className="h-3.5 w-3.5 text-muted-foreground/30" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-[12px] text-foreground truncate">{pred.title}</p>
                  <p className="text-[11px] text-muted-foreground/30 truncate">{pred.responses.length} responses &middot; {pred.rewardTokens} AURA</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: number | string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/20 px-4 py-3 text-left transition-all hover:bg-card/40 hover:border-border/60">
      <div className="text-muted-foreground/25">{icon}</div>
      <div>
        <p className="text-[16px] font-medium text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground/35">{label}</p>
      </div>
    </button>
  );
}

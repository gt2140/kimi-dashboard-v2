import { useMemo } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Brain,
  Droplets,
  FileText,
  Pill,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useChatStore } from "@/hooks/useStore";
import { BUILT_IN_AGENTS } from "@/lib/data";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-5 w-5" />,
  Droplets: <Droplets className="h-5 w-5" />,
  Apple: <Sparkles className="h-5 w-5" />,
  Pill: <Pill className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  Flower2: <Sparkles className="h-5 w-5" />,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const conversationsQuery = trpc.chat.listConversations.useQuery();
  const vaultQuery = trpc.vault.list.useQuery();

  const recentFiles = useMemo(
    () => (vaultQuery.data ?? []).slice(0, 5),
    [vaultQuery.data]
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-[20px] font-medium tracking-tight text-foreground">
              Overview
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground/40">
              {user?.name
                ? `Welcome back, ${user.name}.`
                : "Your authenticated workspace."}
            </p>
          </div>
          <span className="text-[12px] text-muted-foreground/40">
            Stable MVP
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">
            Built-in agents
          </h2>
          <button
            onClick={() => navigate("/agents")}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            All agents <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {BUILT_IN_AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => {
                setActiveAgent(agent.id);
                navigate("/chat");
              }}
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/40 bg-card/20 px-4 py-3 text-left transition-all hover:border-border/70 hover:bg-card/50"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 transition-colors",
                  agent.color
                )}
              >
                {iconMap[agent.icon] ?? <Users className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {agent.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground/40">
                  {agent.description}
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/15 transition-colors group-hover:text-muted-foreground/40" />
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Vault files"
          value={vaultQuery.data?.length ?? 0}
          onClick={() => navigate("/vault")}
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Active agents"
          value={BUILT_IN_AGENTS.length}
          onClick={() => navigate("/agents")}
        />
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Saved chats"
          value={conversationsQuery.data?.length ?? 0}
          onClick={() => navigate("/chat")}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Signed-in user"
          value={user?.name || "Authenticated"}
          onClick={() => navigate("/profile")}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <div className="rounded-xl border border-border/30 bg-card/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Recent uploads
            </h2>
            <button
              onClick={() => navigate("/vault")}
              className="text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground"
            >
              View all
            </button>
          </div>
          <div className="space-y-0.5">
            {recentFiles.map(file => (
              <button
                key={file.id}
                onClick={() => navigate("/vault")}
                className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-card/40"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-muted-foreground/40" />
                <span className="truncate text-[12px] text-foreground">
                  {file.filename}
                </span>
                <span className="ml-auto shrink-0 text-[11px] uppercase text-muted-foreground/25">
                  {file.category}
                </span>
              </button>
            ))}
            {recentFiles.length === 0 && (
              <p className="px-3 py-4 text-[12px] text-muted-foreground/35">
                No vault metadata yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-card/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">
              MVP focus
            </h2>
          </div>
          <div className="rounded-xl border border-border/20 bg-background/35 p-4 text-[12px] leading-relaxed text-muted-foreground/50">
            This MVP is now intentionally centered on the parts that are truly
            persisted: authenticated sessions, saved conversations, and vault
            metadata. Predictions, token economy, and per-agent settings stay
            outside the stable feature set until they are backed by the API and
            database.
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/20 px-4 py-3 text-left transition-all hover:border-border/60 hover:bg-card/40"
    >
      <div className="text-muted-foreground/25">{icon}</div>
      <div>
        <p className="text-[16px] font-medium text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground/35">{label}</p>
      </div>
    </button>
  );
}

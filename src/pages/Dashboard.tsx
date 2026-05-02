import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, FileText, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useChatStore } from "@/hooks/useStore";
import { useKimiChatData } from "@/hooks/useKimiChatData";
import { useLocalVaultStore } from "@/hooks/useLocalVaultStore";
import { BUILT_IN_AGENTS } from "@/lib/data";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ReactNode> = {
  Brain: <Sparkles className="h-5 w-5" />,
  Apple: <Sparkles className="h-5 w-5" />,
  Droplets: <Sparkles className="h-5 w-5" />,
  Pill: <Sparkles className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
  Flower2: <Sparkles className="h-5 w-5" />,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const { sessions } = useKimiChatData();
  const vaultFiles = useLocalVaultStore(state => state.files);

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
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground/40">
              {user?.name
                ? `${user.name}, esta base conserva login real y un frontend listo para volver a construir el backend desde cero.`
                : "Aura conserva auth real y un frontend listo para reconstruir el backend desde cero."}
            </p>
          </div>
          <span className="text-[12px] text-muted-foreground/40">
            minimal
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
            Chat entry points
          </h2>
          <button
            onClick={() => navigate("/kimi/chat")}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            Open chat <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {BUILT_IN_AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => {
                setActiveAgent(agent.id);
                navigate("/kimi/chat");
              }}
              className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/40 bg-card/20 px-4 py-3 text-left transition-all hover:border-border/70 hover:bg-card/50"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/50 transition-colors",
                  agent.color,
                )}
              >
                {iconMap[agent.icon] ?? <Sparkles className="h-5 w-5" />}
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
          icon={<Sparkles className="h-4 w-4" />}
          label="Built-in agents"
          value={BUILT_IN_AGENTS.length}
          onClick={() => navigate("/kimi/chat")}
        />
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Local chats"
          value={sessions.length}
          onClick={() => navigate("/kimi/chat")}
        />
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Local vault files"
          value={vaultFiles.length}
          onClick={() => navigate("/kimi/vault")}
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
        className="mt-6"
      >
        <div className="rounded-xl border border-border/30 bg-card/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Kimi focus
            </h2>
          </div>
          <div className="rounded-xl border border-border/20 bg-background/35 p-4 text-[12px] leading-relaxed text-muted-foreground/50">
            Aura ahora se apoya en una sola ruta viva para conversar:
            auth real en backend y estado local en frontend para chat, agents y vault
            mientras se reconstruye el backend nuevo.
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

import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
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
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatStore } from "@/hooks/useStore";
import { BUILT_IN_AGENTS } from "@/lib/data";
import { getMobileOverviewAgents } from "@/lib/dashboard-agents";
import { cn } from "@/lib/utils";
import { listVaultDocuments } from "@/lib/vault-client";

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
  const isMobile = useIsMobile();
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const { favoriteAgents, favoriteAgentIds } = useAgentCatalog();
  const conversationsQuery = trpc.chat.listConversations.useQuery();
  const vaultQuery = useQuery({
    queryKey: ["vault-documents"],
    queryFn: listVaultDocuments,
  });

  const recentFiles = useMemo(
    () => (vaultQuery.data ?? []).slice(0, 5),
    [vaultQuery.data]
  );
  const mobileOverviewAgents = useMemo(
    () => getMobileOverviewAgents(favoriteAgents, favoriteAgentIds),
    [favoriteAgentIds, favoriteAgents]
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
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground/40">
              {user?.name
                ? `${user.name}, esta capa ahora gira alrededor de Kimi Chat, Kimi Agents y Kimi Vault.`
                : "Aura ahora prioriza Kimi Chat, Kimi Agents y Kimi Vault."}
            </p>
          </div>
          <span className="text-[12px] text-muted-foreground/40">
            Kimi-first
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
            {isMobile ? "Favorite agents" : "Kimi agents"}
          </h2>
          <button
            onClick={() => navigate("/kimi/agents")}
            className="flex items-center gap-1 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            {isMobile ? "Manage" : "Open agents"} <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:hidden">
          {mobileOverviewAgents.map(agent => (
            <button
              key={agent.slug}
              onClick={() => {
                setActiveAgent(agent.slug);
                navigate("/kimi/chat");
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
          <button
            onClick={() => navigate("/kimi/agents")}
            className="flex items-center justify-between rounded-xl border border-dashed border-border/40 bg-card/10 px-4 py-3 text-left transition-all hover:border-border/70 hover:bg-card/30"
          >
            <div>
              <p className="text-[13px] font-medium text-foreground">
                Open Kimi Agents
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/40">
                Elegí favoritos y ajustá memoria, web y tools por perfil.
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/25" />
          </button>
        </div>
        <div className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
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
          onClick={() => navigate("/kimi/vault")}
        />
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Favorite agents"
          value={favoriteAgentIds.length}
          onClick={() => navigate("/kimi/agents")}
        />
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="Kimi chats"
          value={conversationsQuery.data?.length ?? 0}
          onClick={() => navigate("/kimi/chat")}
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
              onClick={() => navigate("/kimi/vault")}
              className="text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground"
            >
              View all
            </button>
          </div>
          <div className="space-y-0.5">
            {recentFiles.map(file => (
              <button
                key={file.id}
                onClick={() => navigate("/kimi/vault")}
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
                Todavia no hay archivos en Kimi Vault.
              </p>
            )}
          </div>
        </div>

        <div className="hidden rounded-xl border border-border/30 bg-card/20 p-4 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">
              Kimi focus
            </h2>
          </div>
          <div className="rounded-xl border border-border/20 bg-background/35 p-4 text-[12px] leading-relaxed text-muted-foreground/50">
            Aura ahora se apoya en tres piezas vivas: conversaciones sobre
            Kimi, agentes con memoria y permisos configurables, y un vault con
            archivos que quedan guardados y se pueden reutilizar como contexto.
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

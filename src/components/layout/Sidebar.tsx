import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  Activity,
  Apple,
  Beaker,
  BookOpen,
  Brain,
  ChevronRight,
  Dna,
  Droplets,
  Flower2,
  Gauge,
  Heart,
  HeartPulse,
  Hourglass,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Shield,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Venus,
  X,
  Zap,
} from "lucide-react";
import { useChatStore } from "@/hooks/useStore";
import { useChatData } from "@/hooks/useChatData";
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const iconMap: Record<string, React.ReactNode> = {
  Activity: <Activity className="h-[18px] w-[18px]" />,
  Brain: <Brain className="h-[18px] w-[18px]" />,
  Apple: <Apple className="h-[18px] w-[18px]" />,
  Beaker: <Beaker className="h-[18px] w-[18px]" />,
  BookOpen: <BookOpen className="h-[18px] w-[18px]" />,
  Dna: <Dna className="h-[18px] w-[18px]" />,
  Droplets: <Droplets className="h-[18px] w-[18px]" />,
  Pill: <Pill className="h-[18px] w-[18px]" />,
  Flower2: <Flower2 className="h-[18px] w-[18px]" />,
  Gauge: <Gauge className="h-[18px] w-[18px]" />,
  HeartPulse: <HeartPulse className="h-[18px] w-[18px]" />,
  Hourglass: <Hourglass className="h-[18px] w-[18px]" />,
  Moon: <Moon className="h-[18px] w-[18px]" />,
  ShieldAlert: <ShieldAlert className="h-[18px] w-[18px]" />,
  Sparkles: <Sparkles className="h-[18px] w-[18px]" />,
  Stethoscope: <Stethoscope className="h-[18px] w-[18px]" />,
  Target: <Target className="h-[18px] w-[18px]" />,
  TrendingUp: <TrendingUp className="h-[18px] w-[18px]" />,
  Venus: <Venus className="h-[18px] w-[18px]" />,
  Zap: <Zap className="h-[18px] w-[18px]" />,
};

const navItems = [
  {
    id: "dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  { id: "agents", label: "Agents", icon: Users, path: "/agents" },
  { id: "chat", label: "Chat", icon: MessageSquare, path: "/chat" },
  { id: "vault", label: "Vault", icon: Shield, path: "/vault" },
];

function getIdentity(
  user: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
  } | null
) {
  const label =
    user?.name?.trim() || user?.email?.trim() || "Authenticated user";
  return {
    label,
    detail: user?.email?.trim() || "Signed in with Google",
    initial: label.charAt(0).toUpperCase(),
    avatar: user?.avatar || null,
  };
}

function ConversationList({
  collapsed,
  sessions,
  onSelect,
  onRemove,
  activeConversationId,
}: {
  collapsed: boolean;
  sessions: Array<{
    id: string;
    title: string;
    calledAgentIds: string[];
  }>;
  onSelect: (sessionId: string) => void;
  onRemove: (sessionId: string) => void;
  activeConversationId: number | null;
}) {
  const location = useLocation();
  const [showHistory, setShowHistory] = useState(true);

  if (collapsed) {
    return (
      <div className="flex-1 overflow-y-auto px-1">
        <p className="py-1 text-center text-[10px] text-sidebar-foreground/20">
          {sessions.length}
        </p>
        <div className="mt-1 space-y-0.5">
          {sessions.slice(0, 3).map(session => (
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className="flex w-full justify-center rounded-md py-1 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/70"
              title={session.title}
            >
              <MessageSquare className="h-3 w-3" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <button
        onClick={() => setShowHistory(current => !current)}
        className="flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30 transition-colors hover:text-sidebar-foreground/50"
      >
        <span>History ({sessions.length})</span>
        {showHistory ? (
          <X className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {showHistory && (
        <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto scrollbar-thin">
          {sessions.map(session => {
            const isActive =
              Number(session.id) === activeConversationId &&
              location.pathname === "/chat";

            return (
              <div
                key={session.id}
                className={cn(
                  "group flex items-start gap-2 rounded-md px-2.5 py-1.5 transition-all",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/40 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/70"
                )}
              >
                <button
                  onClick={() => onSelect(session.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] leading-snug">
                      {session.title}
                    </p>
                    <p className="text-[10px] text-sidebar-foreground/30">
                      {session.calledAgentIds.length > 0
                        ? `+${session.calledAgentIds.length} agents`
                        : "Single"}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => onRemove(session.id)}
                  className="mt-0.5 shrink-0 text-sidebar-foreground/20 opacity-0 transition-opacity hover:text-destructive/60 group-hover:opacity-100"
                  title="Delete conversation"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const identity = useMemo(() => getIdentity(user), [user]);
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const { favoriteAgents } = useAgentCatalog();
  const {
    sessions,
    activeConversationId,
    selectConversation,
    removeConversation,
  } = useChatData();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      <div className="flex h-12 items-center px-4 shrink-0">
        {!collapsed ? (
          <span className="text-[13px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/40">
            Aura
          </span>
        ) : (
          <span className="mx-auto text-[11px] font-medium text-sidebar-foreground/40">
            A
          </span>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "ml-auto hidden h-7 w-7 rounded-full border border-border/40 bg-background/70 text-sidebar-foreground/45 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex",
              collapsed && "mx-auto ml-0"
            )}
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      <nav className="flex shrink-0 flex-col gap-0.5 px-2 pt-2">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex items-center rounded-md py-1.5 text-[13px] transition-colors",
                collapsed
                  ? "mx-auto h-8 w-8 justify-center px-0"
                  : "gap-2.5 px-2.5",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/80"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-60" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mx-3 my-2 h-px shrink-0 bg-border/60" />

      <div className="shrink-0 px-2">
        {!collapsed && (
          <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30">
            Favorites
          </p>
        )}
        {favoriteAgents.map(agent => {
          const isActive =
            activeAgentId === agent.slug &&
            location.pathname === "/chat" &&
            !activeConversationId;

          return (
            <button
              key={agent.slug}
              onClick={() => {
                setActiveAgent(agent.slug);
                navigate("/chat");
              }}
              className={cn(
                "relative flex items-center rounded-md py-1.5 text-[13px] transition-all",
                collapsed
                  ? "mx-auto h-8 w-8 justify-center px-0"
                  : "gap-2.5 px-2.5",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/80"
              )}
              title={collapsed ? agent.name : undefined}
            >
              <span
                className={cn(
                  "shrink-0 opacity-70",
                  isActive ? agent.color : "text-sidebar-foreground/40"
                )}
              >
                {iconMap[agent.icon] ?? <Sparkles className="h-[18px] w-[18px]" />}
              </span>
              {!collapsed && <span>{agent.name}</span>}
            </button>
          );
        })}
        {!collapsed && favoriteAgents.length === 0 && (
          <p className="px-2.5 py-1.5 text-[11px] text-sidebar-foreground/25">
            Add favorites from the agents page.
          </p>
        )}
      </div>

      <div className="mx-3 my-2 h-px shrink-0 bg-border/60" />

      <div className="flex min-h-0 flex-1 flex-col px-2 overflow-hidden">
        <ConversationList
          collapsed={collapsed}
          sessions={sessions}
          onSelect={sessionId => {
            void selectConversation(sessionId);
          }}
          onRemove={sessionId => {
            void removeConversation(sessionId);
          }}
          activeConversationId={activeConversationId}
        />
      </div>

      <div className="shrink-0 border-t border-border/60 p-3">
        <button
          onClick={() => navigate("/profile")}
          className={cn(
            "flex w-full items-center rounded-md text-left transition-colors",
            collapsed ? "justify-center py-1" : "gap-2.5 px-2 py-2",
            location.pathname === "/profile"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/80"
          )}
          title={collapsed ? identity.label : undefined}
        >
          {identity.avatar ? (
            <img
              src={identity.avatar}
              alt={identity.label}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/40 text-[11px] font-medium">
              {identity.initial}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">
                {identity.label}
              </p>
              <p className="text-[10px] text-sidebar-foreground/30">
                {identity.detail}
              </p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const identity = useMemo(() => getIdentity(user), [user]);
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const setActiveAgent = useChatStore(state => state.setActiveAgent);
  const { favoriteAgents } = useAgentCatalog();
  const { sessions, selectConversation, removeConversation } = useChatData();
  const [showHistory, setShowHistory] = useState(true);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[260px] border-r border-border bg-sidebar p-0"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-12 items-center px-4 shrink-0">
            <span className="text-[13px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/40">
              Aura
            </span>
          </div>
          <nav className="flex shrink-0 flex-col gap-0.5 px-2 pt-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-60" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mx-3 my-2 h-px shrink-0 bg-border/60" />

          <div className="shrink-0 px-2">
            <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30">
              Favorites
            </p>
            {favoriteAgents.map(agent => {
              const isActive = activeAgentId === agent.slug;

              return (
                <button
                  key={agent.slug}
                  onClick={() => {
                    setActiveAgent(agent.slug);
                    navigate("/chat");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-all",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 opacity-70",
                      isActive ? agent.color : "text-sidebar-foreground/40"
                    )}
                  >
                    {iconMap[agent.icon] ?? <Sparkles className="h-[18px] w-[18px]" />}
                  </span>
                  <span>{agent.name}</span>
                </button>
              );
            })}
            {favoriteAgents.length === 0 && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-sidebar-foreground/25">
                <Heart className="h-3 w-3" />
                <span>Add favorites from Agents</span>
              </div>
            )}
          </div>

          <div className="mx-3 my-2 h-px shrink-0 bg-border/60" />

          <div className="flex min-h-0 flex-1 flex-col px-2 overflow-hidden">
            <button
              onClick={() => setShowHistory(current => !current)}
              className="flex items-center justify-between px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30"
            >
              <span>History ({sessions.length})</span>
              {showHistory ? (
                <X className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            {showHistory && (
              <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto scrollbar-thin">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className="group flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sidebar-foreground/40 transition-all hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/70"
                  >
                    <button
                      onClick={() => {
                        void selectConversation(session.id);
                        setOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    >
                      <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] leading-snug">
                          {session.title}
                        </p>
                        <p className="text-[10px] text-sidebar-foreground/30">
                          {session.calledAgentIds.length > 0
                            ? `+${session.calledAgentIds.length} agents`
                            : "Single agent"}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        void removeConversation(session.id);
                      }}
                      className="mt-0.5 shrink-0 text-sidebar-foreground/20 opacity-0 transition-opacity hover:text-destructive/60 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border/60 p-3">
            <button
              onClick={() => {
                navigate("/profile");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/80"
            >
              {identity.avatar ? (
                <img
                  src={identity.avatar}
                  alt={identity.label}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 text-[11px] font-medium">
                  {identity.initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">
                  {identity.label}
                </p>
                <p className="text-[10px] text-sidebar-foreground/30">
                  {identity.detail}
                </p>
              </div>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

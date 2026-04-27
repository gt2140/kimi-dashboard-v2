import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  Brain, Droplets, Apple, Pill, Sparkles, Flower2,
  LayoutDashboard, MessageSquare, Shield, Menu, Trophy,
  Users, ChevronRight, Trash2, X, PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { useChatStore } from "@/hooks/useStore";
import { useProfileStore } from "@/hooks/useStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const iconMap: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-[18px] w-[18px]" />,
  Droplets: <Droplets className="h-[18px] w-[18px]" />,
  Apple: <Apple className="h-[18px] w-[18px]" />,
  Pill: <Pill className="h-[18px] w-[18px]" />,
  Sparkles: <Sparkles className="h-[18px] w-[18px]" />,
  Flower2: <Flower2 className="h-[18px] w-[18px]" />,
};

const navItems = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard, path: "/dashboard" },
  { id: "agents", label: "Agents", icon: Users, path: "/agents" },
  { id: "chat", label: "Chat", icon: MessageSquare, path: "/chat" },
  { id: "vault", label: "Vault", icon: Shield, path: "/vault" },
  { id: "predictions", label: "PoH", icon: Trophy, path: "/predictions" },
];

const QUICK_AGENTS = [
  { id: "generalist", icon: "Brain", color: "text-indigo-400", label: "Generalist" },
  { id: "bloodwork", icon: "Droplets", color: "text-red-400", label: "Bloodwork" },
  { id: "peptides", icon: "Sparkles", color: "text-cyan-400", label: "Peptides" },
  { id: "supplements", icon: "Pill", color: "text-amber-400", label: "Supplements" },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const sessions = useChatStore((state) => state.sessions);
  const loadSession = useChatStore((state) => state.loadSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const activeSessionId = useChatStore((state) => state.activeSessionId);
  const setActiveAgent = useChatStore((state) => state.setActiveAgent);
  const navigate = useNavigate();
  const location = useLocation();
  const balance = useProfileStore((s) => s.balance);
  const profile = useProfileStore((s) => s.profile);

  const [showHistory, setShowHistory] = useState(true);

  return (
    <aside className={cn("fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300", collapsed ? "w-[60px]" : "w-[240px]")}>
      {/* Logo */}
      <div className="flex h-12 items-center px-4 shrink-0">
        {!collapsed && (
          <span className="text-[13px] font-medium tracking-[0.15em] uppercase text-sidebar-foreground/40">Aura</span>
        )}
        {collapsed && (
          <span className="text-[11px] font-medium text-sidebar-foreground/40 mx-auto">A</span>
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
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-2 pt-2 shrink-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center rounded-md py-1.5 text-[13px] transition-colors relative",
                collapsed ? "justify-center px-0 mx-auto w-8 h-8" : "gap-2.5 px-2.5",
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-60" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mx-3 my-2 h-px bg-border/60 shrink-0" />

      {/* Quick Access Agents - 4 only */}
      <div className="shrink-0 flex flex-col gap-0.5 px-2">
        {!collapsed && (
          <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30">Quick</p>
        )}
        {QUICK_AGENTS.map((qa) => {
          const isActive = activeAgentId === qa.id && location.pathname === "/chat" && !activeSessionId;
          return (
            <button
              key={qa.id}
              onClick={() => {
                setActiveAgent(qa.id);
                navigate("/chat");
              }}
              className={cn(
                "flex items-center rounded-md py-1.5 text-[13px] transition-all relative",
                collapsed ? "justify-center px-0 mx-auto w-8 h-8" : "gap-2.5 px-2.5",
                isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
              )}
              title={collapsed ? qa.label : undefined}
            >
              <span className={cn("shrink-0 opacity-70", isActive ? qa.color : "text-sidebar-foreground/40")}>
                {iconMap[qa.icon]}
              </span>
              {!collapsed && <span className="capitalize">{qa.id}</span>}
            </button>
          );
        })}
      </div>

      <div className="mx-3 my-2 h-px bg-border/60 shrink-0" />

      {/* Chat History */}
      <div className="flex-1 flex flex-col min-h-0 px-2 overflow-hidden">
        {!collapsed && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center justify-between px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30 hover:text-sidebar-foreground/50 transition-colors"
          >
            <span>History ({sessions.length})</span>
            {showHistory ? <X className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
        {collapsed && (
          <p className="text-center text-[10px] text-sidebar-foreground/20 py-1">{sessions.length}</p>
        )}
        {(!collapsed && showHistory) && (
          <div className="flex-1 overflow-y-auto scrollbar-thin mt-1 space-y-0.5">
            {sessions.map((session) => {
              const isActive = activeSessionId === session.id && location.pathname === "/chat";
              return (
                <button
                  key={session.id}
                  onClick={() => { loadSession(session.id); navigate("/chat"); }}
                  className={cn(
                    "group w-full flex items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition-all",
                    isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30"
                  )}
                >
                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 opacity-50" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] truncate leading-snug">{session.title}</p>
                    <p className="text-[10px] text-sidebar-foreground/30">{session.calledAgentIds.length > 0 ? `+${session.calledAgentIds.length} agents` : "Single"}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                    className="opacity-0 group-hover:opacity-100 text-sidebar-foreground/20 hover:text-destructive/60 transition-opacity shrink-0 mt-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
              );
            })}
          </div>
        )}
        {collapsed && sessions.length > 0 && (
          <div className="flex-1 overflow-y-auto scrollbar-thin mt-1 space-y-0.5 px-1">
            {sessions.slice(0, 3).map((session) => (
              <button
                key={session.id}
                onClick={() => { loadSession(session.id); navigate("/chat"); }}
                className="w-full flex justify-center rounded-md py-1 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30 transition-colors"
                title={session.title}
              >
                <MessageSquare className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Profile Footer */}
      <div className="shrink-0 border-t border-border/60 p-3">
        <button
          onClick={() => navigate("/profile")}
          className={cn(
            "flex items-center w-full rounded-md text-left transition-colors",
            collapsed ? "justify-center py-1" : "gap-2.5 px-2 py-2",
            location.pathname === "/profile" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30"
          )}
          title={collapsed ? `${profile.name} · ${balance.aura.toLocaleString()} AURA` : undefined}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/40 text-[11px] font-medium">
            {profile.name.charAt(0)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate">{profile.name}</p>
              <p className="text-[10px] text-sidebar-foreground/30">{balance.aura.toLocaleString()} AURA</p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const sessions = useChatStore((state) => state.sessions);
  const loadSession = useChatStore((state) => state.loadSession);
  const deleteSession = useChatStore((state) => state.deleteSession);
  const setActiveAgent = useChatStore((state) => state.setActiveAgent);
  const navigate = useNavigate();
  const location = useLocation();
  const balance = useProfileStore((s) => s.balance);
  const profile = useProfileStore((s) => s.profile);
  const [showHistory, setShowHistory] = useState(true);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-r border-border">
        <div className="flex h-full flex-col">
          <div className="flex h-12 items-center px-4 shrink-0">
            <span className="text-[13px] font-medium tracking-[0.15em] uppercase text-sidebar-foreground/40">Aura</span>
          </div>
          <nav className="flex flex-col gap-0.5 px-2 pt-2 shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button key={item.id} onClick={() => { navigate(item.path); setOpen(false); }} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80")}>
                  <Icon className="h-4 w-4 shrink-0 opacity-60" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mx-3 my-2 h-px bg-border/60 shrink-0" />
          <div className="shrink-0 flex flex-col gap-0.5 px-2">
            <p className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30">Quick chat</p>
            {QUICK_AGENTS.map((qa) => {
              const isActive = activeAgentId === qa.id;
              return (
                <button key={qa.id} onClick={() => { setActiveAgent(qa.id); navigate("/chat"); setOpen(false); }} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-all", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80")}>
                  <span className={cn("shrink-0 opacity-70", isActive ? qa.color : "text-sidebar-foreground/40")}>{iconMap[qa.icon]}</span>
                  <span className="capitalize">{qa.id}</span>
                </button>
              );
            })}
          </div>
          <div className="mx-3 my-2 h-px bg-border/60 shrink-0" />
          <div className="flex-1 flex flex-col min-h-0 px-2 overflow-hidden">
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center justify-between px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/30">
              <span>History ({sessions.length})</span>
              {showHistory ? <X className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            {showHistory && (
              <div className="flex-1 overflow-y-auto scrollbar-thin mt-1 space-y-0.5">
                {sessions.map((session) => (
                  <button key={session.id} onClick={() => { loadSession(session.id); navigate("/chat"); setOpen(false); }} className="group w-full flex items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition-all text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/30">
                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 opacity-50" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate leading-snug">{session.title}</p>
                      <p className="text-[10px] text-sidebar-foreground/30">{session.calledAgentIds.length > 0 ? `+${session.calledAgentIds.length} agents` : "Single agent"}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }} className="opacity-0 group-hover:opacity-100 text-sidebar-foreground/20 hover:text-destructive/60 transition-opacity shrink-0 mt-0.5">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-border/60 p-3">
            <button onClick={() => { navigate("/profile"); setOpen(false); }} className="flex items-center gap-2.5 w-full rounded-md px-2 py-2 text-left text-sidebar-foreground/50 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/30 transition-colors">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 text-[11px] font-medium">{profile.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate">{profile.name}</p>
                <p className="text-[10px] text-sidebar-foreground/30">{balance.aura.toLocaleString()} AURA</p>
              </div>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

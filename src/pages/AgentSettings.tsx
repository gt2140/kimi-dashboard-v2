import { useParams, useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  Brain, Droplets, Apple, Pill, Sparkles, Flower2,
  Moon, Hourglass, HeartPulse, Beaker, Venus, Zap,
  BookOpen, Stethoscope, TrendingUp, Target, Dna,
  ShieldAlert, Gauge, Activity, ArrowLeft, Globe,
  Search, BookMarked, MessageSquare, ToggleLeft, Lock
} from "lucide-react";
import { useAgentSettingsStore } from "@/hooks/useStore";
import { AGENTS } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

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

export default function AgentSettingsPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const settings = useAgentSettingsStore((s) => s.settings);
  const updateSettings = useAgentSettingsStore((s) => s.updateSettings);

  const agent = AGENTS.find((a) => a.id === agentId);
  const setting = agentId ? settings[agentId] : undefined;

  if (!agent || !setting) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <button onClick={() => navigate("/agents")} className="text-[12px] text-muted-foreground/40 hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to agents
        </button>
        <p className="mt-8 text-[13px] text-muted-foreground/40">Agent not found</p>
      </div>
    );
  }

  const vaultCategories = ["bloodwork", "genetics", "wearables", "body-composition", "notes", "other"];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <button onClick={() => navigate("/agents")} className="text-[12px] text-muted-foreground/40 hover:text-foreground flex items-center gap-1 mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to agents
        </button>

        <div className="flex items-center gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-muted/40", agent.color)}>
            {allIcons[agent.icon]}
          </div>
          <div>
            <h1 className="text-[18px] font-medium text-foreground">{agent.name}</h1>
            <p className="text-[12px] text-muted-foreground/40">{agent.description}</p>
          </div>
          {agent.source === "marketplace" && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground/40 border border-border/20">Marketplace</span>
          )}
        </div>

        <div className="mt-8 space-y-8">
          {/* Status */}
          <Section title="Status" icon={<ToggleLeft className="h-3.5 w-3.5" />}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-foreground">{setting.enabled ? "Enabled" : "Disabled"}</p>
                <p className="text-[11px] text-muted-foreground/40">{setting.enabled ? "Agent is active and can be called" : "Agent is disabled and won't respond"}</p>
              </div>
              <Switch checked={setting.enabled} onCheckedChange={(v) => updateSettings(agent.id, { enabled: v })} />
            </div>
          </Section>

          {/* Vault Access */}
          <Section title="Vault Access" icon={<Lock className="h-3.5 w-3.5" />}>
            <p className="text-[11px] text-muted-foreground/40 mb-3">Select which vault categories this agent can access</p>
            <div className="flex flex-wrap gap-2">
              {vaultCategories.map((cat) => {
                const active = setting.vaultAccess.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      const next = active ? setting.vaultAccess.filter((c) => c !== cat) : [...setting.vaultAccess, cat];
                      updateSettings(agent.id, { vaultAccess: next });
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all",
                      active ? "border-foreground/20 bg-foreground/5 text-foreground" : "border-border/40 text-muted-foreground/30 hover:text-muted-foreground/50"
                    )}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Tools */}
          <Section title="Tools" icon={<Search className="h-3.5 w-3.5" />}>
            <div className="space-y-3">
              <ToolRow label="Web search" description="Allow agent to search the internet for current information" checked={setting.canSearchWeb} onChange={(v) => updateSettings(agent.id, { canSearchWeb: v })} />
              <ToolRow label="Auto-suggest" description="Proactively suggest follow-up questions and actions" checked={setting.autoSuggest} onChange={(v) => updateSettings(agent.id, { autoSuggest: v })} />
            </div>
          </Section>

          {/* Response Style */}
          <Section title="Response Style" icon={<MessageSquare className="h-3.5 w-3.5" />}>
            <div className="flex gap-2">
              {(["concise", "detailed", "academic"] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => updateSettings(agent.id, { responseStyle: style })}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] font-medium border capitalize transition-all",
                    setting.responseStyle === style ? "border-foreground/20 bg-foreground/5 text-foreground" : "border-border/40 text-muted-foreground/30 hover:text-muted-foreground/50"
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </Section>

          {/* Custom Context */}
          <Section title="Custom Context" icon={<Globe className="h-3.5 w-3.5" />}>
            <p className="text-[11px] text-muted-foreground/40 mb-2">Additional instructions or context for this agent</p>
            <textarea
              value={setting.customContext}
              onChange={(e) => updateSettings(agent.id, { customContext: e.target.value })}
              placeholder="e.g., I am a 35-year-old male, training 5x/week, following a ketogenic diet..."
              className="w-full h-24 rounded-lg border border-border/40 bg-card/30 p-3 text-[12px] text-foreground placeholder:text-muted-foreground/20 resize-none focus:outline-none focus:border-border/70 transition-colors"
            />
          </Section>

          {/* System Prompt Preview */}
          <Section title="System Prompt" icon={<BookMarked className="h-3.5 w-3.5" />}>
            <p className="text-[11px] text-muted-foreground/40 mb-2">This is how the agent is instructed to behave</p>
            <div className="rounded-lg border border-border/40 bg-card/30 p-3 text-[11px] text-muted-foreground/50 leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
              {agent.systemPrompt}
            </div>
          </Section>
        </div>
      </motion.div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-muted-foreground/30">{icon}</span>
        <h3 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground/40">{title}</h3>
      </div>
      <div className="rounded-xl border border-border/30 bg-card/20 p-4">
        {children}
      </div>
    </div>
  );
}

function ToolRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/40">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

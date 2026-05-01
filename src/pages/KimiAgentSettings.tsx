import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Brain,
  DatabaseZap,
  Globe,
  Save,
  Sparkles,
  Wrench,
} from "lucide-react";
import { KimiHeader } from "@/components/kimi/KimiHeader";
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { trpc } from "@/providers/trpc";
import { formatRuntimeError } from "@/lib/app-errors";
import { cn } from "@/lib/utils";

const DEFAULT_TOOLS = [
  "moonshot/memory:latest",
  "moonshot/web-search:latest",
  "moonshot/rethink:latest",
];

export default function KimiAgentSettings() {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const slug = agentId ?? "generalist";
  const { saveUserSettings, isSaving } = useAgentCatalog();
  const providersQuery = trpc.agents.listProviders.useQuery();
  const settingsQuery = trpc.agents.getUserSettings.useQuery(
    { slug },
    { retry: false },
  );

  const [customContext, setCustomContext] = useState("");
  const [trainingNotes, setTrainingNotes] = useState("");
  const [thinkingMode, setThinkingMode] = useState<"enabled" | "disabled">(
    "enabled",
  );
  const [preferKimiMemory, setPreferKimiMemory] = useState(true);
  const [webResearchEnabled, setWebResearchEnabled] = useState(true);
  const [scientificResearchEnabled, setScientificResearchEnabled] =
    useState(false);
  const [formulaToolsText, setFormulaToolsText] = useState("");
  const [responseStyle, setResponseStyle] = useState<
    "concise" | "detailed" | "academic"
  >("detailed");
  const [preferredProviderId, setPreferredProviderId] = useState<number | null>(
    null,
  );
  const [preferredModelId, setPreferredModelId] = useState<number | null>(null);

  const agent = settingsQuery.data?.agent;
  const setting = settingsQuery.data?.setting;
  const providers = providersQuery.data ?? [];
  const selectedProvider = providers.find(
    provider => provider.id === preferredProviderId,
  );
  const availableModels = selectedProvider?.endpoints ?? [];

  useEffect(() => {
    if (!setting) {
      return;
    }

    setCustomContext(setting.customContext ?? "");
    setTrainingNotes(setting.trainingNotes ?? "");
    setThinkingMode(setting.kimiThinkingMode ?? "enabled");
    setPreferKimiMemory(setting.preferKimiMemory ?? true);
    setWebResearchEnabled(setting.allowWebResearch ?? true);
    setScientificResearchEnabled(setting.allowScientificResearch ?? false);
    setFormulaToolsText(
      ((setting.enabledFormulaTools as string[] | undefined) ?? []).join(", "),
    );
    setResponseStyle(setting.responseStyle);
    setPreferredProviderId(setting.preferredProviderId ?? null);
    setPreferredModelId(setting.preferredModelId ?? null);
  }, [setting]);

  useEffect(() => {
    if (preferredProviderId || providers.length === 0) {
      return;
    }

    const kimiProvider = providers.find(
      provider => provider.slug?.toLowerCase() === "kimi",
    );
    if (kimiProvider) {
      setPreferredProviderId(kimiProvider.id);
    }
  }, [preferredProviderId, providers]);

  const resolvedTools = useMemo(
    () =>
      formulaToolsText
        .split(",")
        .map(value => value.trim())
        .filter(Boolean),
    [formulaToolsText],
  );

  async function handleSave() {
    await saveUserSettings({
      slug,
      customContext: customContext || null,
      trainingNotes: trainingNotes || null,
      kimiThinkingMode: thinkingMode,
      preferKimiMemory,
      allowWebResearch: webResearchEnabled,
      allowScientificResearch: scientificResearchEnabled,
      enabledFormulaTools: resolvedTools,
      responseStyle,
      preferredProviderId,
      preferredModelId,
      allowVaultContext: true,
      allowedContextOverrides: agent?.allowedVaultCategories ?? [],
    });
  }

  const error = settingsQuery.error ?? providersQuery.error ?? null;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <KimiHeader
        title={`${agent?.name ?? "Agent"} settings`}
        description="Ajustá cómo este perfil usa thinking, Kimi memory, tools oficiales y routing de modelo dentro del runtime nuevo."
      />

      <button
        onClick={() => navigate("/kimi/agents")}
        className="mb-4 inline-flex items-center gap-1 text-[12px] text-muted-foreground/45 transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Kimi agents
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
          <Panel
            title="Prompt and role"
            description="Base prompt from Aura plus user-specific context and operating notes."
            icon={<Sparkles className="h-4 w-4" />}
          >
            <Field label="Base system prompt">
              <textarea
                readOnly
                value={agent?.systemPrompt ?? ""}
                className="min-h-[120px] w-full rounded-2xl border border-border/25 bg-muted/20 p-3 text-[12px] text-muted-foreground/65 outline-none"
              />
            </Field>
            <Field label="Custom context">
              <textarea
                value={customContext}
                onChange={event => setCustomContext(event.target.value)}
                className="min-h-[120px] w-full rounded-2xl border border-border/25 bg-card/30 p-3 text-[12px] text-foreground outline-none"
              />
            </Field>
            <Field label="Training notes">
              <textarea
                value={trainingNotes}
                onChange={event => setTrainingNotes(event.target.value)}
                className="min-h-[120px] w-full rounded-2xl border border-border/25 bg-card/30 p-3 text-[12px] text-foreground outline-none"
              />
            </Field>
          </Panel>

          <Panel
            title="Kimi reasoning and memory"
            description="Define how much the model should think and whether official Kimi memory is preferred."
            icon={<Brain className="h-4 w-4" />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(["enabled", "disabled"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setThinkingMode(mode)}
                  className={cn(
                    "rounded-2xl border px-4 py-4 text-left",
                    thinkingMode === mode
                      ? "border-amber-300/25 bg-amber-400/10 text-amber-100"
                      : "border-border/25 bg-card/25 text-muted-foreground/55",
                  )}
                >
                  <div className="text-[12px] font-medium capitalize">{mode}</div>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    {mode === "enabled"
                      ? "Use Kimi thinking mode for harder reasoning turns."
                      : "Favor speed and direct output over deliberate thinking."}
                  </p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setPreferKimiMemory(current => !current)}
              className="mt-4 flex w-full items-center justify-between rounded-2xl border border-border/25 bg-card/25 px-4 py-3 text-left"
            >
              <div>
                <p className="text-[12px] font-medium text-foreground">
                  Prefer Kimi memory
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/45">
                  When enabled, Aura exposes `moonshot/memory:latest` as the primary memory capability.
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[10px]",
                  preferKimiMemory
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-muted/30 text-muted-foreground/45",
                )}
              >
                {preferKimiMemory ? "enabled" : "disabled"}
              </span>
            </button>
          </Panel>

          <Panel
            title="Official tools"
            description="Turn Kimi formula tools on or off and add custom entries when needed."
            icon={<Wrench className="h-4 w-4" />}
          >
            <ToggleRow
              title="Web search"
              description="Expose official web-search to this profile."
              enabled={webResearchEnabled}
              onToggle={() => setWebResearchEnabled(current => !current)}
            />
            <ToggleRow
              title="Rethink / scientific mode"
              description="Expose rethink for research-heavy or analytical turns."
              enabled={scientificResearchEnabled}
              onToggle={() => setScientificResearchEnabled(current => !current)}
            />

            <Field label="Enabled formula tools">
              <textarea
                value={formulaToolsText}
                onChange={event => setFormulaToolsText(event.target.value)}
                placeholder="moonshot/memory:latest, moonshot/web-search:latest"
                className="min-h-[90px] w-full rounded-2xl border border-border/25 bg-card/30 p-3 text-[12px] text-foreground outline-none"
              />
            </Field>

            <div className="mt-3 flex flex-wrap gap-2">
              {DEFAULT_TOOLS.map(tool => (
                <button
                  key={tool}
                  onClick={() => {
                    if (resolvedTools.includes(tool)) {
                      return;
                    }
                    setFormulaToolsText(current =>
                      [current, tool].filter(Boolean).join(", "),
                    );
                  }}
                  className="rounded-full border border-border/25 bg-background/40 px-2.5 py-1 text-[10px] text-muted-foreground/55"
                >
                  {tool}
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Routing"
            description="Keep the provider pinned to Kimi or override model selection per profile."
            icon={<Globe className="h-4 w-4" />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Preferred provider">
                <select
                  value={preferredProviderId ?? ""}
                  onChange={event => {
                    const value = event.target.value;
                    setPreferredProviderId(value ? Number(value) : null);
                    setPreferredModelId(null);
                  }}
                  className="h-10 w-full rounded-2xl border border-border/25 bg-card/30 px-3 text-[12px] text-foreground outline-none"
                >
                  <option value="">System default</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Preferred model">
                <select
                  value={preferredModelId ?? ""}
                  onChange={event => {
                    const value = event.target.value;
                    setPreferredModelId(value ? Number(value) : null);
                  }}
                  className="h-10 w-full rounded-2xl border border-border/25 bg-card/30 px-3 text-[12px] text-foreground outline-none"
                >
                  <option value="">System default</option>
                  {availableModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["concise", "detailed", "academic"] as const).map(style => (
                <button
                  key={style}
                  onClick={() => setResponseStyle(style)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px]",
                    responseStyle === style
                      ? "border-sky-300/25 bg-sky-400/10 text-sky-100"
                      : "border-border/25 bg-card/25 text-muted-foreground/50",
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </Panel>
        </section>

        <aside className="space-y-4">
          <Panel
            title="Resolved profile"
            description="Quick view of what this agent will expose to Kimi."
            icon={<DatabaseZap className="h-4 w-4" />}
          >
            <Info label="Thinking mode" value={thinkingMode} />
            <Info
              label="Memory strategy"
              value={preferKimiMemory ? "Kimi official memory" : "Aura-first memory"}
            />
            <Info
              label="Research tools"
              value={
                scientificResearchEnabled
                  ? "web-search + rethink"
                  : webResearchEnabled
                    ? "web-search"
                    : "manual only"
              }
            />
            <Info label="Response style" value={responseStyle} />
          </Panel>

          <button
            onClick={() => {
              void handleSave();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-[12px] text-background transition-opacity hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Kimi settings"}
          </button>
        </aside>
      </div>

      {error && (
        <p className="mt-4 text-[12px] text-destructive/80">
          {formatRuntimeError(error, "Kimi agent settings")}
        </p>
      )}
    </div>
  );
}

function Panel({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/35 bg-card/20 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-muted/25 text-muted-foreground/55">
          {icon}
        </div>
        <div>
          <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/45">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/35">
        {label}
      </p>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="mt-3 flex w-full items-center justify-between rounded-2xl border border-border/25 bg-card/25 px-4 py-3 text-left first:mt-0"
    >
      <div>
        <p className="text-[12px] font-medium text-foreground">{title}</p>
        <p className="mt-1 text-[11px] text-muted-foreground/45">
          {description}
        </p>
      </div>
      <span
        className={cn(
          "rounded-full px-3 py-1 text-[10px]",
          enabled
            ? "bg-emerald-500/15 text-emerald-200"
            : "bg-muted/30 text-muted-foreground/45",
        )}
      >
        {enabled ? "on" : "off"}
      </span>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/15 py-2 text-[12px] last:border-b-0">
      <span className="text-muted-foreground/45">{label}</span>
      <span className="text-foreground/85">{value}</span>
    </div>
  );
}

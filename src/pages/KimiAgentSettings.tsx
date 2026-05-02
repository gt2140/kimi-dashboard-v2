import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Brain, DatabaseZap, Globe, Save, Sparkles } from "lucide-react";
import { KimiHeader } from "@/components/kimi/KimiHeader";
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { trpc } from "@/providers/trpc";
import { formatRuntimeError } from "@/lib/app-errors";
import { cn } from "@/lib/utils";

export default function KimiAgentSettings() {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const slug = agentId ?? "generalist";
  const { saveUserSettings, isSaving } = useAgentCatalog();
  const settingsQuery = trpc.agents.getUserSettings.useQuery({ slug }, { retry: false });

  const [customContext, setCustomContext] = useState("");
  const [thinkingMode, setThinkingMode] = useState<"enabled" | "disabled">("enabled");
  const [preferKimiMemory, setPreferKimiMemory] = useState(true);
  const [webResearchEnabled, setWebResearchEnabled] = useState(true);
  const [vaultContextEnabled, setVaultContextEnabled] = useState(true);
  const [responseStyle, setResponseStyle] = useState<"concise" | "detailed" | "academic">("detailed");

  const agent = settingsQuery.data?.agent;
  const setting = settingsQuery.data?.setting;

  useEffect(() => {
    if (!setting) {
      return;
    }

    setCustomContext(setting.customContext ?? "");
    setThinkingMode(setting.kimiThinkingMode ?? "enabled");
    setPreferKimiMemory(setting.preferKimiMemory ?? true);
    setWebResearchEnabled(setting.allowWebResearch ?? true);
    setVaultContextEnabled(setting.allowVaultContext ?? true);
    setResponseStyle(setting.responseStyle);
  }, [setting]);

  async function handleSave() {
    await saveUserSettings({
      slug,
      customContext: customContext || null,
      kimiThinkingMode: thinkingMode,
      preferKimiMemory,
      allowWebResearch: webResearchEnabled,
      allowVaultContext: vaultContextEnabled,
      responseStyle,
    });
  }

  const error = settingsQuery.error ?? null;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6 lg:p-8">
      <KimiHeader
        title={`${agent?.name ?? "Agent"} settings`}
        description="Cada perfil de Kimi se reduce a lo esencial: contexto extra, thinking, memory, vault y estilo de respuesta."
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
            title="Prompt"
            description="El prompt base del agente sigue igual. Acá solo podés sumar una capa corta de contexto personal."
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
          </Panel>

          <Panel
            title="Thinking and memory"
            description="El backend nuevo usa un loop directo a Kimi con historial corto. Solo ajustamos intensidad y memory strategy."
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
                      ? "Use more deliberate reasoning for harder prompts."
                      : "Favor speed and direct answers."}
                  </p>
                </button>
              ))}
            </div>

            <ToggleRow
              title="Prefer Kimi memory"
              description="Mantiene la estrategia de memoria centrada en Kimi para este perfil."
              enabled={preferKimiMemory}
              onToggle={() => setPreferKimiMemory(current => !current)}
            />
          </Panel>

          <Panel
            title="Context toggles"
            description="Dos switches simples para decidir si este perfil puede apoyarse en web y vault."
            icon={<DatabaseZap className="h-4 w-4" />}
          >
            <ToggleRow
              title="Web search"
              description="Permite usar b\u00fasqueda web cuando haga falta."
              enabled={webResearchEnabled}
              onToggle={() => setWebResearchEnabled(current => !current)}
            />
            <ToggleRow
              title="Vault context"
              description="Permite que este perfil use archivos del vault como contexto."
              enabled={vaultContextEnabled}
              onToggle={() => setVaultContextEnabled(current => !current)}
            />
          </Panel>

          <Panel
            title="Response style"
            description="No cambia el modelo. Solo ordena la forma de responder."
            icon={<Globe className="h-4 w-4" />}
          >
            <div className="flex flex-wrap gap-2">
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
            description="Vista r\u00e1pida de lo que realmente cambia en este agent."
            icon={<DatabaseZap className="h-4 w-4" />}
          >
            <Info label="Thinking mode" value={thinkingMode} />
            <Info label="Memory strategy" value={preferKimiMemory ? "Kimi memory" : "Aura memory"} />
            <Info label="Web access" value={webResearchEnabled ? "enabled" : "disabled"} />
            <Info label="Vault context" value={vaultContextEnabled ? "enabled" : "disabled"} />
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
        <p className="mt-1 text-[11px] text-muted-foreground/45">{description}</p>
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

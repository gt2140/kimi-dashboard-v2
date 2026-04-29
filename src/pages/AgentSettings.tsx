import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Database,
  FileText,
  Globe,
  Heart,
  Microscope,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { AGENTS } from "@/lib/data";
import { trpc } from "@/providers/trpc";
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { formatRuntimeError } from "@/lib/app-errors";
import { cn } from "@/lib/utils";

const internetSources = [
  "PubMed and clinical trials",
  "Scientific journals and review papers",
  "Guideline libraries and consensus statements",
  "Medical knowledge bases",
];

export default function AgentSettingsPage() {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const slug = agentId ?? "generalist";
  const { saveUserSettings, favoriteAgentIds, isSaving } = useAgentCatalog();
  const providersQuery = trpc.agents.listProviders.useQuery();
  const userSettingsQuery = trpc.agents.getUserSettings.useQuery(
    { slug },
    { retry: false }
  );
  const agent = AGENTS.find(item => item.id === slug) || AGENTS[0];
  const persistedAgent = userSettingsQuery.data?.agent;
  const isFavorite = favoriteAgentIds.includes(slug);
  const isPinnedGeneralist = slug === "generalist";

  const [customContext, setCustomContext] = useState("");
  const [trainingNotes, setTrainingNotes] = useState("");
  const [webResearchEnabled, setWebResearchEnabled] = useState(true);
  const [libraryResearchEnabled, setLibraryResearchEnabled] = useState(false);
  const [useVaultContext, setUseVaultContext] = useState(true);
  const [responseStyle, setResponseStyle] = useState<
    "concise" | "detailed" | "academic"
  >("detailed");
  const [preferredProviderId, setPreferredProviderId] = useState<number | null>(
    null
  );
  const [preferredModelId, setPreferredModelId] = useState<number | null>(null);

  useEffect(() => {
    const setting = userSettingsQuery.data?.setting;
    if (!setting) {
      return;
    }

    setCustomContext(
      setting.customContext ??
        `Use this space to describe how ${agent.name} should think, what it should prioritize, and which user-specific nuances it should remember.`
    );
    setTrainingNotes(
      setting.trainingNotes ??
        "Example: focus on longitudinal lab comparisons, explain uncertainty clearly, and prefer evidence over speculative recommendations."
    );
    setWebResearchEnabled(setting.allowWebResearch);
    setLibraryResearchEnabled(setting.allowScientificResearch);
    setUseVaultContext(setting.allowVaultContext);
    setResponseStyle(setting.responseStyle);
    setPreferredProviderId(setting.preferredProviderId);
    setPreferredModelId(setting.preferredModelId);
  }, [agent.name, userSettingsQuery.data?.setting]);

  const contextPills = useMemo(
    () => [
      ...agent.allowedVaultCategories.map(category => ({
        label: category,
        tone: "neutral",
      })),
      { label: "custom instructions", tone: "accent" },
      { label: "retrieval memory", tone: "accent" },
    ],
    [agent.allowedVaultCategories]
  );

  const selectedProvider = providersQuery.data?.find(
    provider => provider.id === preferredProviderId
  );
  const availableModels = selectedProvider?.endpoints ?? [];

  async function handleSave() {
    await saveUserSettings({
      slug,
      isFavorite,
      customContext,
      trainingNotes,
      responseStyle,
      preferredProviderId,
      preferredModelId,
      allowVaultContext: useVaultContext,
      allowWebResearch: webResearchEnabled,
      allowScientificResearch: libraryResearchEnabled,
      allowedContextOverrides: agent.allowedVaultCategories,
    });
  }

  const error = userSettingsQuery.error ?? providersQuery.error ?? null;

  return (
    <div className="mx-auto w-full max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/agents")}
            className="mb-3 flex items-center gap-1 text-[12px] text-muted-foreground/45 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to agents
          </button>
          <h1 className="text-[22px] font-medium tracking-tight text-foreground">
            {agent.name} settings
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground/40">
            This screen prepares the configuration layer for each agent: context,
            training notes, vault access, internet research and future
            provider-specific behavior. It is frontend-first for now.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (isPinnedGeneralist) {
                return;
              }

              void saveUserSettings({
                slug,
                isFavorite: !isFavorite,
              });
            }}
            disabled={isPinnedGeneralist}
            className={cn(
              "flex items-center gap-1 rounded-md border px-3 py-2 text-[12px] transition-colors",
              isFavorite
                ? "border-rose-300/40 bg-rose-400/10 text-rose-200"
                : "border-border/30 bg-card/30 text-muted-foreground/55 hover:text-foreground",
              isPinnedGeneralist && "cursor-default"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", isFavorite && "fill-current")} />
            {isPinnedGeneralist
              ? "Always pinned"
              : isFavorite
                ? "In favorites"
                : "Add to favorites"}
          </button>
          <button
            onClick={() => {
              void handleSave();
            }}
            className="flex items-center gap-1 rounded-md bg-foreground px-3 py-2 text-[12px] text-background transition-opacity hover:opacity-90"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <Panel
            title="Agent context"
            description="Define the default instructions and private context this agent should receive before every conversation."
            icon={<Brain className="h-4 w-4" />}
          >
            <div className="space-y-3">
              <FieldLabel label="Base system prompt" />
              <textarea
                value={persistedAgent?.systemPrompt ?? agent.systemPrompt}
                readOnly
                className="min-h-[120px] w-full rounded-xl border border-border/30 bg-muted/20 p-3 text-[12px] leading-relaxed text-muted-foreground/70 outline-none"
              />
            </div>

            <div className="mt-4 space-y-3">
              <FieldLabel label="Custom context for this user + agent" />
              <textarea
                value={customContext}
                onChange={event => setCustomContext(event.target.value)}
                className="min-h-[140px] w-full rounded-xl border border-border/30 bg-card/30 p-3 text-[12px] leading-relaxed text-foreground outline-none transition-colors focus:border-border/60"
              />
            </div>

            <div className="mt-4 space-y-3">
              <FieldLabel label="Training notes / operating preferences" />
              <textarea
                value={trainingNotes}
                onChange={event => setTrainingNotes(event.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-border/30 bg-card/30 p-3 text-[12px] leading-relaxed text-foreground outline-none transition-colors focus:border-border/60"
              />
            </div>
          </Panel>

          <Panel
            title="Research behavior"
            description="Prepare how this agent should search, retrieve and ground answers when the backend orchestration arrives."
            icon={<Microscope className="h-4 w-4" />}
          >
            <ToggleRow
              icon={<Globe className="h-4 w-4" />}
              title="Enable internet research"
              description="Allow this agent to search the web before answering."
              value={webResearchEnabled}
              onToggle={() => setWebResearchEnabled(current => !current)}
            />
            <ToggleRow
              icon={<BookOpen className="h-4 w-4" />}
              title="Enable scientific libraries"
              description="Prioritize sources like PubMed, reviews, and guideline repositories."
              value={libraryResearchEnabled}
              onToggle={() => setLibraryResearchEnabled(current => !current)}
            />
            <ToggleRow
              icon={<Database className="h-4 w-4" />}
              title="Use vault context"
              description="Inject user-specific data from uploaded files when relevant."
              value={useVaultContext}
              onToggle={() => setUseVaultContext(current => !current)}
            />

            <div className="mt-4 rounded-xl border border-border/30 bg-muted/20 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/35">
                Planned scientific sources
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {internetSources.map(source => (
                  <span
                    key={source}
                    className="rounded-full border border-border/20 bg-card/30 px-2 py-1 text-[11px] text-muted-foreground/50"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </Panel>

          <Panel
            title="Provider routing"
            description="Prepare which provider and model this agent should prefer when the model gateway is connected."
            icon={<Database className="h-4 w-4" />}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel label="Preferred provider" />
                <select
                  value={preferredProviderId ?? ""}
                  onChange={event => {
                    const value = event.target.value;
                    setPreferredProviderId(value ? Number(value) : null);
                    setPreferredModelId(null);
                  }}
                  className="mt-2 h-10 w-full rounded-xl border border-border/30 bg-card/30 px-3 text-[12px] text-foreground outline-none"
                >
                  <option value="">System default</option>
                  {providersQuery.data?.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel label="Preferred model" />
                <select
                  value={preferredModelId ?? ""}
                  onChange={event => {
                    const value = event.target.value;
                    setPreferredModelId(value ? Number(value) : null);
                  }}
                  className="mt-2 h-10 w-full rounded-xl border border-border/30 bg-card/30 px-3 text-[12px] text-foreground outline-none"
                >
                  <option value="">System default</option>
                  {availableModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <FieldLabel label="Response style" />
              <div className="mt-2 flex flex-wrap gap-2">
                {(["concise", "detailed", "academic"] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => setResponseStyle(style)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
                      responseStyle === style
                        ? "border-sky-300/30 bg-sky-400/10 text-sky-200"
                        : "border-border/25 bg-card/20 text-muted-foreground/45 hover:text-foreground"
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
          </Panel>
        </section>

        <aside className="space-y-4">
          <Panel
            title="Context sources"
            description="What this agent is expected to consume once the backend is wired."
            icon={<Sparkles className="h-4 w-4" />}
          >
            <div className="flex flex-wrap gap-2">
              {contextPills.map(item => (
                <span
                  key={item.label}
                  className={cn(
                    "rounded-full border px-2 py-1 text-[11px]",
                    item.tone === "accent"
                      ? "border-sky-300/20 bg-sky-400/10 text-sky-200"
                      : "border-border/20 bg-card/30 text-muted-foreground/50"
                  )}
                >
                  {item.label}
                </span>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-dashed border-border/35 bg-card/20 p-4">
              <div className="flex items-center gap-2 text-[12px] text-foreground">
                <Upload className="h-4 w-4 text-muted-foreground/40" />
                Upload agent-specific training material
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/40">
                Future use cases: protocol PDFs, private notes, clinical
                frameworks, benchmark docs, and prompt attachments.
              </p>
            </div>
          </Panel>

          <Panel
            title="Execution profile"
            description="Current resolved preferences for this agent."
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            <InfoRow
              label="Preferred provider"
              value={selectedProvider?.name ?? "System default"}
            />
            <InfoRow
              label="Preferred model"
              value={
                availableModels.find(model => model.id === preferredModelId)?.label ??
                "System default"
              }
            />
            <InfoRow
              label="Response style"
              value={responseStyle}
            />
            <InfoRow label="Collaboration mode" value="Can assist and be consulted" />
            <InfoRow label="Favorite status" value={isFavorite ? "Visible in sidebar" : "Only in marketplace"} />
          </Panel>

          <Panel
            title="Planned actions"
            description="These actions will later connect to backend workflows."
            icon={<Search className="h-4 w-4" />}
          >
            <ActionButton label="Connect scientific sources" icon={<Globe className="h-3.5 w-3.5" />} />
            <ActionButton label="Attach training documents" icon={<FileText className="h-3.5 w-3.5" />} />
            <ActionButton label="Tune prompt and role" icon={<Brain className="h-3.5 w-3.5" />} />
            <ActionButton label="Set memory rules" icon={<Database className="h-3.5 w-3.5" />} />
          </Panel>
        </aside>
      </div>

      {error && (
        <p className="mt-4 text-[12px] text-destructive/80">
          {formatRuntimeError(error, "Agent settings")}
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
    <section className="rounded-2xl border border-border/30 bg-card/20 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground/50">
          {icon}
        </div>
        <div>
          <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/40">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/35">
      {label}
    </p>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl border border-border/25 bg-card/20 px-3 py-3 text-left transition-colors hover:border-border/45"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground/45">{icon}</div>
        <div>
          <p className="text-[12px] font-medium text-foreground">{title}</p>
          <p className="mt-1 text-[11px] text-muted-foreground/40">
            {description}
          </p>
        </div>
      </div>
      <div
        className={cn(
          "h-5 w-9 rounded-full border transition-colors",
          value
            ? "border-emerald-300/40 bg-emerald-400/20"
            : "border-border/30 bg-muted/30"
        )}
      >
        <div
          className={cn(
            "mt-[1px] h-4 w-4 rounded-full bg-white transition-transform",
            value ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </div>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/20 py-2 text-[12px] last:border-b-0">
      <span className="text-muted-foreground/40">{label}</span>
      <span className="text-foreground/80">{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button className="mb-2 flex w-full items-center gap-2 rounded-xl border border-border/25 bg-card/20 px-3 py-2.5 text-[12px] text-muted-foreground/55 transition-colors hover:border-border/45 hover:text-foreground last:mb-0">
      {icon}
      <span>{label}</span>
    </button>
  );
}

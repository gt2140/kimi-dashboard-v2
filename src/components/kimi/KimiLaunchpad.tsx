import { useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Brain,
  CheckCircle2,
  DatabaseZap,
  FileSearch,
  MessageSquareCode,
  Settings2,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAgentCatalog } from "@/hooks/useAgentCatalog";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type KimiLaunchpadVariant = "chat" | "vault" | "agents";

export function KimiLaunchpad({
  variant,
}: {
  variant: KimiLaunchpadVariant;
}) {
  const navigate = useNavigate();
  const { backendReady, user } = useAuth();
  const vaultQuery = trpc.vault.list.useQuery(undefined, {
    retry: false,
  });
  const { userSettings } = useAgentCatalog();

  const generalistSetting = userSettings.find(
    setting => setting.agent.slug === "generalist",
  );
  const vaultFiles = vaultQuery.data ?? [];
  const extractedReadyCount = vaultFiles.filter(
    file =>
      (file as { extractionStatus?: string | null }).extractionStatus === "ready",
  ).length;
  const hasProjectMemory =
    Boolean(generalistSetting?.customContext?.trim()) ||
    Boolean(generalistSetting?.trainingNotes?.trim()) ||
    generalistSetting?.preferKimiMemory !== false;

  const steps = useMemo(
    () => [
      {
        id: "session",
        title: "Session ready",
        description: backendReady
          ? `Signed in as ${user?.email ?? user?.name ?? "your account"}`
          : "Sign in and let Aura sync the backend session",
        complete: backendReady,
        actionLabel: backendReady ? undefined : "Go to login",
        action: () => navigate("/login"),
        icon: CheckCircle2,
      },
      {
        id: "vault",
        title: "Vault ready",
        description:
          extractedReadyCount > 0
            ? `${extractedReadyCount} extracted file${extractedReadyCount === 1 ? "" : "s"} available for retrieval`
            : "Upload at least one file so Kimi can ground answers in your data",
        complete: extractedReadyCount > 0,
        actionLabel: extractedReadyCount > 0 ? "Open vault" : "Upload file",
        action: () => navigate("/kimi/vault"),
        icon: FileSearch,
      },
      {
        id: "memory",
        title: "Project memory",
        description: hasProjectMemory
          ? "Generalist already has persistent context or Kimi memory enabled"
          : "Define fixed context and operating notes for Generalist",
        complete: hasProjectMemory,
        actionLabel: "Configure agent",
        action: () => navigate("/kimi/agents/generalist"),
        icon: Brain,
      },
      {
        id: "chat",
        title: "First Kimi chat",
        description:
          backendReady && hasProjectMemory
            ? "Start a turn and Aura will persist summary and stable user memories after the reply"
            : "Finish setup, then start your first Kimi-powered conversation",
        complete: false,
        actionLabel: "Open chat",
        action: () => navigate("/kimi/chat"),
        icon: MessageSquareCode,
      },
    ],
    [backendReady, extractedReadyCount, hasProjectMemory, navigate, user?.email, user?.name],
  );

  const recommendedAction = (() => {
    if (!backendReady) {
      return steps[0];
    }
    if (extractedReadyCount === 0) {
      return steps[1];
    }
    if (!hasProjectMemory) {
      return steps[2];
    }
    return steps[3];
  })();

  return (
    <div className="rounded-3xl border border-border/35 bg-card/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/35">
            Kimi Launchpad
          </p>
          <h3 className="mt-1 text-[15px] font-medium text-foreground">
            Ready to test the app
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/45">
            Esta capa estÃ¡ pensada para probar un flujo simple: contexto fijo
            del agente, archivos en vault y memoria persistente despuÃ©s de cada
            turno.
          </p>
        </div>
        <DatabaseZap className="h-5 w-5 text-amber-200/70" />
      </div>

      <div className="mt-4 space-y-2">
        {steps.map(step => {
          const Icon = step.icon;
          const isHighlighted = recommendedAction.id === step.id;

          return (
            <div
              key={step.id}
              className={cn(
                "rounded-2xl border px-3 py-3 transition-colors",
                step.complete
                  ? "border-emerald-500/20 bg-emerald-500/8"
                  : isHighlighted
                    ? "border-amber-300/20 bg-amber-400/8"
                    : "border-border/20 bg-background/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl",
                      step.complete
                        ? "bg-emerald-500/14 text-emerald-200"
                        : isHighlighted
                          ? "bg-amber-400/14 text-amber-100"
                          : "bg-muted/25 text-muted-foreground/45",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-medium text-foreground">
                        {step.title}
                      </p>
                      {step.complete && (
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                          ready
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/45">
                      {step.description}
                    </p>
                  </div>
                </div>

                {step.actionLabel && (variant !== "chat" || step.id !== "chat") && (
                  <button
                    onClick={step.action}
                    className="shrink-0 rounded-full border border-border/25 px-2.5 py-1 text-[10px] text-foreground/75 transition-colors hover:bg-card/40"
                  >
                    {step.actionLabel}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-border/20 bg-background/35 px-3 py-3">
        <div className="flex items-center gap-2 text-[12px] text-foreground">
          <Settings2 className="h-4 w-4 text-muted-foreground/45" />
          What persists between turns
        </div>
        <div className="mt-2 grid gap-2">
          {[
            "Conversation summary for the current thread",
            "Stable user memories extracted after replies",
            "Fixed Generalist context and training notes",
            "Vault chunks selected from extracted files",
          ].map(item => (
            <div
              key={item}
              className="rounded-xl border border-border/15 bg-card/20 px-3 py-2 text-[11px] text-muted-foreground/50"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  Brain,
  DatabaseZap,
  FileSearch,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useKimiChatData } from "@/hooks/useKimiChatData";
import { useChatStore } from "@/hooks/useStore";
import { resolveAuraRuntimeOptions } from "@/lib/aura-runtime";
import { AGENTS } from "@/lib/data";
import {
  type PendingTurnStage,
} from "@/lib/chat-experience";
import { buildKimiChatTimeline } from "@/lib/kimi-chat-timeline";
import {
  applyRuntimeStageUpdate,
  createInitialPendingStages,
  resolveActiveStageIndex,
} from "@/lib/kimi-chat-stages";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

const allIcons: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-3.5 w-3.5" />,
  Sparkles: <Sparkles className="h-3.5 w-3.5" />,
};

type StreamingAssistant = {
  content: string;
  metadata?: Message["metadata"];
};

type KimiMetadata = NonNullable<Message["metadata"]> & {
  thinkingMode?: "enabled" | "disabled";
  memoryApplied?: boolean;
  toolCalls?: string[];
};

const SHORTCUTS = [
  "Resume esta conversacion y detecta hechos estables sobre mi",
  "Usa mi vault y decime que documentos son relevantes para esta pregunta",
  "Pensa paso a paso y decime si necesitas usar web-search o memory",
];

export default function KimiChat() {
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const calledAgentIds = useChatStore(state => state.calledAgentIds);
  const runtimeVersion = useChatStore(state => state.runtimeVersion);
  const medicalMode = useChatStore(state => state.medicalMode);
  const policyLevel = useChatStore(state => state.policyLevel);
  const setRuntimeVersion = useChatStore(state => state.setRuntimeVersion);
  const setMedicalMode = useChatStore(state => state.setMedicalMode);
  const callAgent = useChatStore(state => state.callAgent);
  const removeCalledAgent = useChatStore(state => state.removeCalledAgent);
  const clearChat = useChatStore(state => state.clearChat);
  const {
    messages,
    isConversationLoading,
    isSending,
    error,
    startNewChat,
    streamMessage,
  } = useKimiChatData();

  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [pendingStages, setPendingStages] = useState<PendingTurnStage[]>([]);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [streamingAssistant, setStreamingAssistant] =
    useState<StreamingAssistant | null>(null);
  const [showHelperPicker, setShowHelperPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeAgent = AGENTS.find(agent => agent.id === activeAgentId) ?? AGENTS[0];
  const runtime = resolveAuraRuntimeOptions({
    runtimeVersion,
    medicalMode,
    policyLevel,
  });
  const availableHelpers = AGENTS.filter(
    agent => agent.id !== activeAgentId && !calledAgentIds.includes(agent.id),
  );

  const displayedMessages = useMemo(
    () =>
      buildKimiChatTimeline({
        messages,
        activeAgentId,
        pendingUserMessage,
        streamingAssistant,
      }),
    [activeAgentId, messages, pendingUserMessage, streamingAssistant],
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [displayedMessages, pendingStages, scrollToBottom]);

  useEffect(() => {
    if (!streamingAssistant || messages.length === 0) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage?.role === "assistant" &&
      lastMessage.content.trim() &&
      lastMessage.content.trim() === streamingAssistant.content.trim()
    ) {
      setStreamingAssistant(null);
    }
  }, [messages, streamingAssistant]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const showPendingStages =
    isSending &&
    pendingStages.length > 0 &&
    !(streamingAssistant?.content.trim());

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) {
      return;
    }

    const content = input.trim();
    setPendingUserMessage(content);
    setPendingStages(createInitialPendingStages());
    setActiveStageIndex(0);
    setStreamingAssistant(null);
    setInput("");

    try {
      await streamMessage(content, {
        onStage: stage => {
          setPendingStages(current => {
            const next = applyRuntimeStageUpdate(current, {
              id: stage.stageId,
              label: stage.label,
            });
            setActiveStageIndex(resolveActiveStageIndex(next));
            return next;
          });
        },
        onTextDelta: event => {
          setStreamingAssistant(current => ({
            content: `${current?.content ?? ""}${event.delta}`,
            metadata: current?.metadata,
          }));
        },
        onMessageComplete: event => {
          setStreamingAssistant({
            content: event.message.content,
            metadata: event.message.metadata,
          });
        },
      });
    } catch (error) {
      setInput(current => (current.trim().length > 0 ? current : content));
      throw error;
    } finally {
      setPendingUserMessage(null);
      setPendingStages([]);
      setActiveStageIndex(0);
    }
  }, [activeAgentId, calledAgentIds, input, isSending, streamMessage]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-[1500px] min-w-0 flex-col overflow-hidden p-3 sm:p-4 lg:p-5">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border/40 bg-card/20">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/35">
                {runtime.runtimeVersion === "aura-medical-v1"
                  ? "Aura medical runtime"
                  : "Kimi chat"}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[14px] text-foreground">
                <span className={cn("text-amber-200/85", activeAgent.color)}>
                  {allIcons[activeAgent.icon] ?? <Sparkles className="h-3.5 w-3.5" />}
                </span>
                <span className="truncate">{activeAgent.name}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground/45">
                {runtime.runtimeVersion === "aura-medical-v1"
                  ? "Modo dual para personal health y research con policy conservadora por defecto."
                  : "Memoria, vault y tools en una vista mas compacta."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHelperPicker(current => !current)}
                className="inline-flex items-center gap-1 rounded-full border border-border/35 bg-card/30 px-3 py-1.5 text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Helper
              </button>
              <button
                onClick={() => {
                  clearChat();
                  void startNewChat(activeAgentId);
                }}
                className="rounded-full border border-border/35 bg-card/30 px-3 py-1.5 text-[11px] text-muted-foreground/50 transition-colors hover:text-foreground"
              >
                New chat
              </button>
            </div>
          </div>

          <div className="border-b border-border/25 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <RuntimeChip
                active={runtime.runtimeVersion === "aura-medical-v1"}
                onClick={() => setRuntimeVersion("aura-medical-v1")}
              >
                Aura Medical V1
              </RuntimeChip>
              <RuntimeChip
                active={runtime.runtimeVersion === "classic"}
                onClick={() => setRuntimeVersion("classic")}
              >
                Classic Kimi
              </RuntimeChip>
              <div className="mx-1 hidden h-4 w-px bg-border/40 sm:block" />
              <RuntimeChip
                active={runtime.medicalMode === "personal-health"}
                onClick={() => setMedicalMode("personal-health")}
              >
                Personal Health
              </RuntimeChip>
              <RuntimeChip
                active={runtime.medicalMode === "research"}
                onClick={() => setMedicalMode("research")}
              >
                Research
              </RuntimeChip>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-100/80">
                policy {runtime.policyLevel}
              </span>
            </div>
          </div>

          {showHelperPicker && (
            <div className="border-b border-border/25 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {availableHelpers.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      callAgent(agent.id);
                      setShowHelperPicker(false);
                    }}
                    className="rounded-full border border-border/30 bg-card/25 px-3 py-1.5 text-[11px] text-muted-foreground/55 transition-colors hover:text-foreground"
                  >
                    {agent.name}
                  </button>
                ))}
                {availableHelpers.length === 0 && (
                  <span className="text-[11px] text-muted-foreground/35">
                    No hay mas helpers disponibles.
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {isConversationLoading ? (
              <LoadingState label="Loading Kimi conversation" />
            ) : displayedMessages.length === 0 && !pendingUserMessage ? (
              <EmptyState onShortcutClick={setInput} />
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {displayedMessages.map(message => (
                  <KimiMessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={message.id === "kimi-streaming"}
                  />
                ))}
                {showPendingStages && (
                  <div className="rounded-2xl border border-border/30 bg-background/40 p-3">
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground/55">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {pendingStages[activeStageIndex]?.label ?? "Working"}
                    </div>
                    {pendingStages.length > 1 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {pendingStages
                          .filter((_, index) => index !== activeStageIndex)
                          .map((stage, index) => {
                            const originalIndex = pendingStages.findIndex(
                              item => item.id === stage.id
                            );
                            return (
                              <span
                                key={`${stage.id}-${index}`}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[10px]",
                                  originalIndex < activeStageIndex
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200/80"
                                    : "border-border/30 bg-card/25 text-muted-foreground/35",
                                )}
                              >
                                {stage.label}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-border/30 bg-background/70 px-4 py-4 backdrop-blur">
            {calledAgentIds.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {calledAgentIds.map(id => {
                  const agent = AGENTS.find(item => item.id === id);
                  if (!agent) {
                    return null;
                  }

                  return (
                    <button
                      key={id}
                      onClick={() => removeCalledAgent(id)}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-100/80"
                    >
                      {agent.name}
                      <X className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-border/35 bg-card/30 p-3">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={
                  runtime.runtimeVersion === "aura-medical-v1"
                    ? runtime.medicalMode === "research"
                      ? "Preguntale a Aura por evidencia, PubMed, trials o tus documentos..."
                      : "Preguntale a Aura por biomarcadores, documentos, suplementos o research..."
                    : "Preguntale a Aura usando Kimi, memory y vault..."
                }
                className="min-h-[36px] max-h-[160px] resize-none border-0 bg-transparent p-0 text-[13px] leading-relaxed placeholder:text-muted-foreground/30 focus-visible:ring-0"
              />
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl"
                disabled={!input.trim() || isSending}
                onClick={() => {
                  void handleSend();
                }}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {error && (
              <p className="mt-2 text-[12px] text-destructive/80">{error}</p>
            )}
          </div>
      </section>
    </div>
  );
}

function EmptyState({ onShortcutClick }: { onShortcutClick: (value: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Sparkles className="h-6 w-6 text-amber-200/70" />
      <h2 className="mt-4 text-[18px] font-medium text-foreground">
        Aura Medical V1 esta listo
      </h2>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground/45">
        Esta version prioriza Kimi memory, tools oficiales y retrieval desde el
        vault antes de llegar al texto final.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {SHORTCUTS.map(shortcut => (
          <button
            key={shortcut}
            onClick={() => onShortcutClick(shortcut)}
            className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/25 px-3 py-2 text-[11px] text-muted-foreground/55 transition-colors hover:text-foreground"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            {shortcut}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground/40">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function KimiMessageBubble({
  message,
  isStreaming = false,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  const metadata = (message.metadata ?? undefined) as KimiMetadata | undefined;
  const researchEvidence = metadata?.researchEvidence ?? [];

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/35 text-muted-foreground/55">
        {isUser ? "A" : <Sparkles className="h-4 w-4" />}
      </div>
      <div className={cn("flex max-w-[88%] flex-col gap-2", isUser && "items-end")}>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/35">
          <span>{isUser ? "You" : "Aura / Kimi"}</span>
          <span>
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isStreaming && <span className="text-sky-300/80">streaming</span>}
        </div>

        <div
          className={cn(
            "rounded-2xl border px-4 py-3 text-[13px] leading-relaxed",
            isUser
              ? "border-border/30 bg-foreground/5 text-foreground"
              : "border-border/30 bg-card/30 text-foreground/90",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && researchEvidence.length > 0 && (
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-sky-100/70">
              <FileSearch className="h-3.5 w-3.5" />
              Evidence
            </div>
            <div className="mt-3 space-y-2">
              {researchEvidence.map(source => (
                <a
                  key={`${source.source}-${source.url}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-border/25 bg-background/40 p-3 transition-colors hover:border-sky-400/30 hover:bg-background/60"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-sky-100/55">
                    <DatabaseZap className="h-3.5 w-3.5" />
                    {source.source === "pubmed" ? "PubMed" : "ClinicalTrials"}
                  </div>
                  <p className="mt-2 text-[12px] font-medium text-foreground/90">
                    {source.title}
                  </p>
                  {source.citation && (
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/65">
                      {source.citation}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {!isUser && metadata && (
          <div className="flex flex-wrap gap-2">
            {metadata.runtimeVersion && (
              <MetaPill icon={<Sparkles className="h-3 w-3" />}>
                {metadata.runtimeVersion}
              </MetaPill>
            )}
            {metadata.medicalMode && (
              <MetaPill icon={<Brain className="h-3 w-3" />}>
                {metadata.medicalMode}
              </MetaPill>
            )}
            <MetaPill icon={<Sparkles className="h-3 w-3" />}>
              {metadata.providerSlug ?? "kimi"} | {metadata.modelName ?? "kimi-k2.6"}
            </MetaPill>
            {metadata.thinkingMode && (
              <MetaPill icon={<Brain className="h-3 w-3" />}>
                thinking {metadata.thinkingMode}
              </MetaPill>
            )}
            {metadata.memoryApplied && (
              <MetaPill icon={<DatabaseZap className="h-3 w-3" />}>
                memory applied
              </MetaPill>
            )}
            {metadata.relatedVaultFiles && metadata.relatedVaultFiles.length > 0 && (
              <MetaPill icon={<FileSearch className="h-3 w-3" />}>
                {metadata.relatedVaultFiles.length} vault files
              </MetaPill>
            )}
            {metadata.toolCalls && metadata.toolCalls.length > 0 && (
              <MetaPill icon={<Wrench className="h-3 w-3" />}>
                {metadata.toolCalls.join(", ")}
              </MetaPill>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetaPill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/25 bg-background/40 px-2.5 py-1 text-[10px] text-muted-foreground/55">
      {icon}
      {children}
    </span>
  );
}

function RuntimeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] transition-colors",
        active
          ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
          : "border-border/30 bg-card/25 text-muted-foreground/55 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

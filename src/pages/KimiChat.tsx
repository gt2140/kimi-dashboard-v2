import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  Brain,
  ChevronDown,
  DatabaseZap,
  FileSearch,
  Check,
  Loader2,
  Mic,
  Plus,
  Search,
  Send,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useKimiChatData } from "@/hooks/useKimiChatData";
import { useChatStore } from "@/hooks/useStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { type PendingTurnStage } from "@/lib/chat-experience";
import { buildKimiChatTimeline } from "@/lib/kimi-chat-timeline";
import {
  filterCuratedTextModels,
  getSelectedModelOption,
  type CuratedTextModelOption,
} from "@/lib/model-catalog";
import {
  applyRuntimeStageUpdate,
  createInitialPendingStages,
  resolveActiveStageIndex,
} from "@/lib/kimi-chat-stages";
import { AGENTS } from "@/lib/data";
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
  "Summarize the stable facts you already know about me",
  "Check my vault and tell me which files matter for this question",
  "Think step by step and say whether web search or memory is needed",
];

function getVisibleProviderLabel(metadata?: KimiMetadata) {
  const providerSlug = metadata?.providerSlug?.toLowerCase();
  if (!providerSlug || providerSlug === "kimi") {
    return metadata?.requestedProviderSlug ? "Aura override" : "Aura";
  }

  return metadata?.providerSlug ?? "Aura";
}

function getVisibleModelLabel(metadata?: KimiMetadata) {
  const requestedModelName = metadata?.requestedModelName?.trim();
  if (requestedModelName) {
    return requestedModelName;
  }

  if (!metadata?.modelName || metadata.modelName.toLowerCase().includes("kimi")) {
    return "Auto";
  }

  return metadata.modelName;
}

export default function KimiChat() {
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const calledAgentIds = useChatStore(state => state.calledAgentIds);
  const chatViewMode = useChatStore(state => state.chatViewMode);
  const selectedProviderSlug = useChatStore(state => state.selectedProviderSlug);
  const selectedModelName = useChatStore(state => state.selectedModelName);
  const setMedicalMode = useChatStore(state => state.setMedicalMode);
  const setChatViewMode = useChatStore(state => state.setChatViewMode);
  const setSelectedModel = useChatStore(state => state.setSelectedModel);
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
  const isMobile = useIsMobile();

  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [pendingStages, setPendingStages] = useState<PendingTurnStage[]>([]);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [streamingAssistant, setStreamingAssistant] =
    useState<StreamingAssistant | null>(null);
  const [showHelperPicker, setShowHelperPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeAgent = AGENTS.find(agent => agent.id === activeAgentId) ?? AGENTS[0];
  const availableHelpers = AGENTS.filter(
    agent => agent.id !== activeAgentId && !calledAgentIds.includes(agent.id),
  );

  const selectedModelOption = useMemo(
    () => getSelectedModelOption(selectedProviderSlug, selectedModelName),
    [selectedModelName, selectedProviderSlug],
  );
  const filteredModels = useMemo(
    () => filterCuratedTextModels(modelSearch),
    [modelSearch],
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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
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
    setPendingStages(
      createInitialPendingStages({
        primaryAgentId: activeAgentId,
        helperAgentIds: calledAgentIds,
        userMessage: content,
      }),
    );
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
    } catch (streamError) {
      setInput(current => (current.trim().length > 0 ? current : content));
      throw streamError;
    } finally {
      setPendingUserMessage(null);
      setPendingStages([]);
      setActiveStageIndex(0);
    }
  }, [activeAgentId, calledAgentIds, input, isSending, streamMessage]);

  const handleSelectModel = (option: CuratedTextModelOption) => {
    setSelectedModel({
      providerSlug: option.providerSlug,
      modelName: option.modelName,
    });
    setShowModelPicker(false);
    setModelSearch("");
  };

  return (
    <>
      <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-[1380px] min-w-0 flex-col overflow-hidden px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[30px] border border-border/40 bg-card/15 shadow-[0_20px_80px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between border-b border-border/20 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className={cn("text-amber-200/80", activeAgent.color)}>
                  {allIcons[activeAgent.icon] ?? <Sparkles className="h-4 w-4" />}
                </span>
                <span className="truncate">{activeAgent.name}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/55">
                <span>
                  {chatViewMode === "research"
                    ? "Research mode"
                    : chatViewMode === "health"
                      ? "Health mode"
                      : "General mode"}
                </span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span>{selectedModelOption.displayName}</span>
              </div>
            </div>
            <button
              onClick={() => {
                clearChat();
                void startNewChat(activeAgentId);
              }}
              className="rounded-full border border-border/35 bg-background/40 px-3 py-1.5 text-[11px] text-muted-foreground/65 transition-colors hover:text-foreground"
            >
              New chat
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {isConversationLoading ? (
              <LoadingState label="Loading conversation" />
            ) : displayedMessages.length === 0 && !pendingUserMessage ? (
              <EmptyState
                onShortcutClick={setInput}
                selectedModelLabel={selectedModelOption.displayName}
              />
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {displayedMessages.map(message => (
                  <KimiMessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={message.id === "kimi-streaming"}
                  />
                ))}
                {showPendingStages && (
                  <div className="rounded-2xl border border-border/25 bg-background/55 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground/60">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {pendingStages[activeStageIndex]?.label ?? "Working"}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-border/20 bg-background/75 px-3 py-3 backdrop-blur sm:px-4">
            <div className="mx-auto max-w-4xl rounded-[28px] border border-border/30 bg-card/55 p-3 shadow-[0_10px_40px_rgba(0,0,0,0.18)]">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ModeChip
                  active={chatViewMode === "general"}
                  onClick={() => {
                    setChatViewMode("general");
                    setMedicalMode("personal-health");
                  }}
                >
                  General
                </ModeChip>
                <ModeChip
                  active={chatViewMode === "health"}
                  onClick={() => {
                    setChatViewMode("health");
                    setMedicalMode("personal-health");
                  }}
                >
                  Health
                </ModeChip>
                <ModeChip
                  active={chatViewMode === "research"}
                  onClick={() => {
                    setChatViewMode("research");
                    setMedicalMode("research");
                  }}
                >
                  Research
                </ModeChip>
                {calledAgentIds.map(id => {
                  const agent = AGENTS.find(item => item.id === id);
                  if (!agent) {
                    return null;
                  }

                  return (
                    <button
                      key={id}
                      onClick={() => removeCalledAgent(id)}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-100/85"
                    >
                      {agent.name}
                      <X className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>

              <div className="relative">
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
                    chatViewMode === "research"
                      ? "Ask for evidence, trials, PubMed, or document-backed analysis..."
                      : chatViewMode === "health"
                        ? "Ask about biomarkers, symptoms, supplements, or vault context..."
                    : "Ask about biomarkers, supplements, symptoms, or vault context..."
                  }
                  className={cn(
                    "max-h-[144px] resize-none border-0 bg-transparent p-0 text-[14px] leading-relaxed placeholder:text-muted-foreground/30 focus-visible:ring-0",
                    input.trim().length === 0 ? "min-h-[64px] pr-12 md:min-h-[56px]" : "min-h-[56px]",
                  )}
                />
                {input.trim().length === 0 && (
                  <button
                    type="button"
                    aria-label="Voice input coming soon"
                    onClick={() => undefined}
                    className="absolute bottom-1 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground/55 transition-colors hover:text-foreground"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
                  {isMobile ? (
                    <ComposerPill onClick={() => setShowHelperPicker(true)}>
                      <Plus className="h-3.5 w-3.5" />
                      Helper
                    </ComposerPill>
                  ) : (
                    <Popover open={showHelperPicker} onOpenChange={setShowHelperPicker}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border/30 bg-background/50 px-3 text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Helper
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="top"
                        sideOffset={12}
                        className="w-[360px] rounded-[24px] border border-white/8 bg-[#0b0b10] p-2 shadow-[0_28px_90px_rgba(0,0,0,0.62)]"
                      >
                        <DesktopHelperMenu
                          availableHelpers={availableHelpers}
                          onSelect={agentId => {
                            callAgent(agentId);
                            setShowHelperPicker(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  {isMobile ? (
                    <ComposerPill onClick={() => setShowModelPicker(true)}>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span className="truncate">{selectedModelOption.displayName}</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </ComposerPill>
                  ) : (
                    <Popover open={showModelPicker} onOpenChange={setShowModelPicker}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border/30 bg-background/50 px-3 text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="truncate">{selectedModelOption.displayName}</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="top"
                        sideOffset={12}
                        className="w-[460px] rounded-[26px] border border-white/8 bg-[#09090d] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.65)]"
                      >
                        <DesktopModelMenu
                          modelSearch={modelSearch}
                          onSearchChange={setModelSearch}
                          filteredModels={filteredModels}
                          selectedProviderSlug={selectedProviderSlug}
                          selectedModelName={selectedModelName}
                          onSelect={option => {
                            handleSelectModel(option);
                            setShowModelPicker(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                <Button
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full"
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
            </div>

            {error && (
              <p className="mx-auto mt-2 max-w-3xl text-[12px] text-destructive/80">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>

      <Drawer
        open={isMobile && showHelperPicker}
        onOpenChange={setShowHelperPicker}
        direction="bottom"
      >
        <DrawerContent className="border-border/50 bg-card">
          <DrawerHeader className="text-left">
            <DrawerTitle>Add helper</DrawerTitle>
            <DrawerDescription>
              Bring a specialist into the turn without leaving the chat.
            </DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-4 pb-5">
            <div className="space-y-3">
              {availableHelpers.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => {
                    callAgent(agent.id);
                    setShowHelperPicker(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-2xl border border-border/30 bg-background/45 p-3 text-left transition-colors hover:border-border/50"
                >
                  <div className="mt-0.5 rounded-2xl border border-border/25 bg-card/50 p-2 text-amber-200/80">
                    {allIcons[agent.icon] ?? <Sparkles className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{agent.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground/60">
                      {agent.description}
                    </p>
                  </div>
                </button>
              ))}
              {availableHelpers.length === 0 && (
                <div className="rounded-2xl border border-border/25 bg-background/40 px-4 py-5 text-sm text-muted-foreground/55">
                  All available helpers are already attached to this turn.
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={isMobile && showModelPicker}
        onOpenChange={open => {
          setShowModelPicker(open);
          if (!open) {
            setModelSearch("");
          }
        }}
        direction="bottom"
      >
        <DrawerContent className="border-border/50 bg-card">
          <DrawerHeader className="text-left">
            <DrawerTitle>Models</DrawerTitle>
            <DrawerDescription>
              Text-only curated models for lean chat turns.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
              <Input
                value={modelSearch}
                onChange={event => setModelSearch(event.target.value)}
                placeholder="Search models..."
                className="h-11 rounded-2xl border-border/35 bg-background/50 pl-10"
              />
            </div>

            <div className="mt-4 max-h-[56vh] space-y-2 overflow-y-auto pb-2">
              {filteredModels.map(option => (
                <button
                  key={`${option.providerSlug}:${option.modelName ?? "auto"}`}
                  onClick={() => handleSelectModel(option)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-colors",
                    selectedProviderSlug === option.providerSlug &&
                      selectedModelName === option.modelName
                      ? "border-sky-400/40 bg-sky-500/10"
                      : "border-border/30 bg-background/40 hover:border-border/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {option.displayName}
                        </p>
                        {option.modelId && (
                          <span className="rounded-full border border-border/25 bg-card/45 px-2 py-0.5 text-[10px] text-muted-foreground/55">
                            {option.providerLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        {option.modelId ?? "Uses Aura defaults"} · {option.contextWindow}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {option.badges.map(badge => (
                      <span
                        key={`${option.displayName}-${badge}`}
                        className="rounded-full border border-border/25 bg-card/45 px-2 py-0.5 text-[10px] text-muted-foreground/65"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
              {filteredModels.length === 0 && (
                <div className="rounded-2xl border border-border/25 bg-background/40 px-4 py-5 text-sm text-muted-foreground/55">
                  No curated models match this search yet.
                </div>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function EmptyState({
  onShortcutClick,
  selectedModelLabel,
}: {
  onShortcutClick: (value: string) => void;
  selectedModelLabel: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground/55">
        <Sparkles className="h-4 w-4 text-amber-200/70" />
        <span>Aura is ready</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
        <span>{selectedModelLabel}</span>
      </div>
      <div className="mt-4 flex max-w-4xl flex-wrap justify-center gap-2">
        {SHORTCUTS.map(shortcut => (
          <button
            key={shortcut}
            onClick={() => onShortcutClick(shortcut)}
            className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/20 px-3 py-2 text-[11px] text-muted-foreground/60 transition-colors hover:text-foreground"
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
      <div className={cn("flex max-w-[90%] flex-col gap-2", isUser && "items-end")}>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/35">
          <span>{isUser ? "You" : "Aura"}</span>
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
            "rounded-[24px] border px-4 py-3 text-[13px] leading-relaxed",
            isUser
              ? "border-border/30 bg-foreground/5 text-foreground"
              : "border-border/30 bg-card/35 text-foreground/90",
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
              {getVisibleProviderLabel(metadata)} · {getVisibleModelLabel(metadata)}
            </MetaPill>
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
    <span className="inline-flex items-center gap-1 rounded-full border border-border/25 bg-background/45 px-2.5 py-1 text-[10px] text-muted-foreground/60">
      {icon}
      {children}
    </span>
  );
}

function ModeChip({
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
        "rounded-full border px-3 py-1 text-[10px] transition-colors",
        active
          ? "border-sky-400/30 bg-sky-500/12 text-sky-100"
          : "border-border/30 bg-background/40 text-muted-foreground/55 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ComposerPill({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border/30 bg-background/50 px-3 text-[11px] text-muted-foreground/70 transition-colors hover:text-foreground"
    >
      {children}
    </button>
  );
}

function DesktopHelperMenu({
  availableHelpers,
  onSelect,
}: {
  availableHelpers: typeof AGENTS;
  onSelect: (agentId: string) => void;
}) {
  return (
    <div>
      <div className="px-2 pb-2 pt-1">
        <p className="text-sm font-medium text-foreground">Helpers</p>
        <p className="mt-1 text-xs text-muted-foreground/55">
          Add a specialist to this turn.
        </p>
      </div>
      <div className="max-h-[320px] space-y-1 overflow-y-auto">
        {availableHelpers.map(agent => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className="flex w-full items-start gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition-colors hover:border-white/6 hover:bg-white/[0.04]"
          >
            <div className="mt-0.5 rounded-2xl border border-border/20 bg-card/60 p-2 text-amber-200/80">
              {allIcons[agent.icon] ?? <Sparkles className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{agent.name}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground/55">
                {agent.description}
              </p>
            </div>
          </button>
        ))}
        {availableHelpers.length === 0 && (
          <div className="rounded-2xl px-3 py-4 text-sm text-muted-foreground/55">
            All helpers are already active.
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopModelMenu({
  modelSearch,
  onSearchChange,
  filteredModels,
  selectedProviderSlug,
  selectedModelName,
  onSelect,
}: {
  modelSearch: string;
  onSearchChange: (value: string) => void;
  filteredModels: CuratedTextModelOption[];
  selectedProviderSlug: string;
  selectedModelName: string | null;
  onSelect: (option: CuratedTextModelOption) => void;
}) {
  return (
    <div>
      <div className="px-1 pb-3">
        <p className="text-center text-xl font-semibold text-foreground">Models</p>
        <p className="mt-1 text-center text-xs text-muted-foreground/50">
          Curated text models for lean chat turns
        </p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/45" />
        <Input
          value={modelSearch}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search models..."
          className="h-11 rounded-2xl border-white/8 bg-white/[0.03] pl-10"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 px-1">
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] text-muted-foreground/60">
          Text
        </span>
        <span className="rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[10px] text-muted-foreground/60">
          Curated
        </span>
      </div>
      <div className="mt-3 max-h-[360px] overflow-y-auto pr-1">
        <div className="space-y-1">
          {filteredModels.map(option => {
            const isSelected =
              selectedProviderSlug === option.providerSlug &&
              selectedModelName === option.modelName;

            return (
              <button
                key={`${option.providerSlug}:${option.modelName ?? "auto"}`}
                onClick={() => onSelect(option)}
                className={cn(
                  "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                  isSelected
                    ? "border-white/10 bg-white/[0.08]"
                    : "border-transparent bg-transparent hover:border-white/6 hover:bg-white/[0.04]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {option.displayName}
                      </p>
                      <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground/55">
                        {option.providerLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground/55">
                      {option.modelId ?? "Uses Aura defaults"} · {option.contextWindow}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {option.badges.map(badge => (
                        <span
                          key={`${option.displayName}-${badge}`}
                          className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground/60"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isSelected && (
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-black">
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {filteredModels.length === 0 && (
            <div className="rounded-2xl px-3 py-4 text-sm text-muted-foreground/55">
              No curated models match this search yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

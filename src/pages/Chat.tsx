import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ArrowRight,
  Plus,
  X,
  Brain,
  Droplets,
  Apple,
  Pill,
  Flower2,
  Info,
  Files,
} from "lucide-react";
import { useChatStore } from "@/hooks/useStore";
import { useChatData } from "@/hooks/useChatData";
import { AGENTS } from "@/lib/data";
import {
  advanceRevealContent,
  buildPendingTurnStages,
  type PendingTurnStage,
} from "@/lib/chat-experience";
import type { Message } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const allIcons: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-3 w-3" />,
  Droplets: <Droplets className="h-3 w-3" />,
  Apple: <Apple className="h-3 w-3" />,
  Pill: <Pill className="h-3 w-3" />,
  Sparkles: <Sparkles className="h-3 w-3" />,
  Flower2: <Flower2 className="h-3 w-3" />,
};

const SHORTCUTS: Record<string, string[]> = {
  generalist: [
    "Interpret my latest bloodwork",
    "Explain my DEXA scan",
    "Help me review genetic variants",
  ],
  bloodwork: [
    "Help me optimize my lipid panel",
    "Interpret my hormone levels",
    "Check inflammation markers",
  ],
  nutrition: [
    "Build me a meal plan",
    "Help me optimize my macros",
    "Suggest training-day nutrition",
  ],
  supplements: [
    "Review my current supplement stack",
    "Check supplement interactions",
    "Suggest a sleep support stack",
  ],
  peptides: [
    "Help me think through a BPC-157 protocol",
    "Compare TB-500 dosing approaches",
    "What labs should I monitor for peptides?",
  ],
  psychedelics: [
    "Help me think through a microdosing schedule",
    "What safety screening should I do first?",
    "How should I approach integration practices?",
  ],
};

type RevealingAssistantState = {
  message: Message;
  targetContent: string;
  visibleContent: string;
  isComplete: boolean;
};

export default function Chat() {
  const isMobile = useIsMobile();
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const calledAgentIds = useChatStore((state) => state.calledAgentIds);
  const callAgent = useChatStore((state) => state.callAgent);
  const removeCalledAgent = useChatStore((state) => state.removeCalledAgent);
  const clearChat = useChatStore((state) => state.clearChat);

  const {
    messages,
    activeConversationId,
    isConversationLoading,
    isSending,
    error,
    startNewChat,
    streamMessage,
  } = useChatData();

  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [pendingStages, setPendingStages] = useState<PendingTurnStage[]>([]);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [revealingAssistant, setRevealingAssistant] =
    useState<RevealingAssistantState | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeAgent = AGENTS.find((agent) => agent.id === activeAgentId) || AGENTS[0];
  const composerPlaceholder = isMobile
    ? `Ask ${activeAgent.name.toLowerCase()} about your health data...`
    : `Ask ${activeAgent.name.toLowerCase()} anything about ${activeAgent.allowedVaultCategories.join(", ")}. Use @agent-name to force a specialist consult.`;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [
    messages,
    pendingUserMessage,
    pendingStages,
    revealingAssistant?.visibleContent,
    scrollToBottom,
  ]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!revealingAssistant) {
      return;
    }

    if (revealingAssistant.visibleContent === revealingAssistant.targetContent) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setRevealingAssistant((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          visibleContent: advanceRevealContent(
            current.visibleContent,
            current.targetContent,
          ),
        };
      });
    }, 32);

    return () => window.clearTimeout(timeoutId);
  }, [revealingAssistant]);

  useEffect(() => {
    if (!revealingAssistant) {
      return;
    }

    const hasPersistedMessage = messages.some(
      (message) => message.id === revealingAssistant.message.id,
    );

    if (
      hasPersistedMessage &&
      revealingAssistant.isComplete &&
      revealingAssistant.visibleContent === revealingAssistant.targetContent
    ) {
      setRevealingAssistant(null);
    }
  }, [messages, revealingAssistant]);

  const displayedMessages = useMemo(() => {
    if (!revealingAssistant) {
      return messages;
    }

    const revealedMessage = {
      ...revealingAssistant.message,
      content: revealingAssistant.visibleContent,
    };
    const existingIndex = messages.findIndex(
      (message) => message.id === revealingAssistant.message.id,
    );

    if (existingIndex === -1) {
      return [...messages, revealedMessage];
    }

    return messages.map((message) =>
      message.id === revealingAssistant.message.id ? revealedMessage : message,
    );
  }, [messages, revealingAssistant]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) {
      return;
    }

    const content = input.trim();
    const predictedStages = buildPendingTurnStages({
      primaryAgentId: activeAgentId,
      helperAgentIds: calledAgentIds,
      userMessage: content,
    });
    setPendingStages(predictedStages);
    setActiveStageIndex(0);
    setPendingUserMessage(content);
    setRevealingAssistant(null);
    setInput("");

    try {
      await streamMessage(content, {
        onStage: (stage) => {
          setPendingStages((current) => {
            const existingIndex = current.findIndex((item) => item.id === stage.stageId);
            if (existingIndex >= 0) {
              setActiveStageIndex(existingIndex);
              return current;
            }

            const next = [...current, { id: stage.stageId, label: stage.label }];
            setActiveStageIndex(next.length - 1);
            return next;
          });
        },
        onTextDelta: (event) => {
          const draftStageIndex = predictedStages.findIndex(
            (item) => item.id === "draft",
          );
          if (draftStageIndex >= 0) {
            setActiveStageIndex((current) => Math.max(current, draftStageIndex));
          }

          setRevealingAssistant((current) =>
            current
              ? {
                  ...current,
                  targetContent: `${current.targetContent}${event.delta}`,
                }
              : {
                  message: {
                    id: "streaming-assistant",
                    role: "assistant",
                    content: "",
                    agentId: activeAgentId,
                    timestamp: new Date(),
                  },
                  targetContent: event.delta,
                  visibleContent: "",
                  isComplete: false,
                },
          );
        },
        onMessageComplete: (event) => {
          setRevealingAssistant((current) => {
            const completedMessage: Message = {
              id: event.message.id,
              role: "assistant",
              content: event.message.content,
              agentId: event.message.agentId,
              timestamp: new Date(event.message.createdAt),
              metadata: event.message.metadata as Message["metadata"],
            };

            return {
              message: completedMessage,
              targetContent: event.message.content,
              visibleContent: current?.visibleContent ?? "",
              isComplete: true,
            };
          });
        },
      });
    } catch {
      setRevealingAssistant((current) =>
        current?.targetContent && current.targetContent.length > 0
          ? current
          : null,
      );
    } finally {
      setPendingUserMessage(null);
      setPendingStages([]);
      setActiveStageIndex(0);
    }
  }, [activeAgentId, calledAgentIds, input, isSending, streamMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const availableAgents = AGENTS.filter(
    (agent) => agent.id !== activeAgentId && !calledAgentIds.includes(agent.id),
  );

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-h-[calc(100dvh-3rem)] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className={cn("text-muted-foreground/50", activeAgent.color)}>
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-medium">{activeAgent.name}</h2>
            {calledAgentIds.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground/20">+</span>
                {calledAgentIds.map((id) => {
                  const agent = AGENTS.find((item) => item.id === id);
                  if (!agent) {
                    return null;
                  }
                  return (
                    <button
                      key={id}
                      onClick={() => removeCalledAgent(id)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2 py-0.5 text-[10px] hover:border-destructive/30 transition-colors",
                        agent.color,
                      )}
                    >
                      {allIcons[agent.icon]} {agent.name} <X className="h-2.5 w-2.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="flex items-center gap-1 rounded-md border border-border/40 bg-card/30 px-2 py-1.5 text-[11px] text-muted-foreground/50 hover:text-foreground hover:border-border/60 transition-all sm:px-2.5"
            >
              <Plus className="h-3 w-3" /> <span className={cn(isMobile && "hidden")}>Add helper</span>
            </button>
            <AnimatePresence>
              {showAgentPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-border/60 bg-card/95 backdrop-blur-md shadow-lg p-1.5"
                >
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/30">
                    Available helpers
                  </p>
                  {availableAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        callAgent(agent.id);
                        setShowAgentPicker(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors text-left"
                    >
                      <span className={agent.color}>{allIcons[agent.icon]}</span>
                      <span>{agent.name}</span>
                    </button>
                  ))}
                  {availableAgents.length === 0 && (
                    <p className="px-2 py-2 text-[11px] text-muted-foreground/25">
                      All helpers added
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => {
              clearChat();
              void startNewChat(activeAgentId);
            }}
            className="px-1 text-[11px] text-muted-foreground/30 transition-colors hover:text-foreground sm:px-2"
          >
            New
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-6 sm:py-6">
        {isConversationLoading ? (
          <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground/40">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Loading conversation...
          </div>
        ) : displayedMessages.length === 0 && !pendingUserMessage ? (
          <EmptyState
            agentId={activeAgentId}
            onShortcutClick={(text) => setInput(text)}
          />
        ) : (
          <div className="mx-auto max-w-2xl space-y-6 pb-4 sm:space-y-8">
            {displayedMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={
                  revealingAssistant?.message.id === message.id &&
                  message.content !== revealingAssistant.targetContent
                }
              />
            ))}
            {pendingUserMessage && (
              <MessageBubble
                message={{
                  id: "pending-user-message",
                  role: "user",
                  content: pendingUserMessage,
                  agentId: activeAgentId,
                  timestamp: new Date(),
                }}
              />
            )}
            {isSending && !revealingAssistant && (
              <ThinkingBubble
                agentName={activeAgent.name}
                stages={pendingStages}
                currentStageIndex={activeStageIndex}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-border/60 bg-background/95 px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] backdrop-blur sm:px-6 sm:py-4">
        <div className="mx-auto max-w-2xl">
          {calledAgentIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {calledAgentIds.map((id) => {
                const agent = AGENTS.find((item) => item.id === id);
                if (!agent) {
                  return null;
                }
                return (
                  <span
                    key={id}
                    className={cn(
                      "flex items-center gap-1 rounded-full border border-border/30 bg-card/20 px-2 py-0.5 text-[10px]",
                      agent.color,
                    )}
                  >
                    {allIcons[agent.icon]} {agent.name} on call
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-lg border border-border/60 bg-card/30 p-2 transition-colors focus-within:border-border focus-within:bg-card/60 sm:p-2.5">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={composerPlaceholder}
              className="min-h-[28px] max-h-[84px] resize-none border-0 bg-transparent p-0 text-[12px] leading-relaxed placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0 sm:min-h-[36px] sm:max-h-[120px] sm:text-[13px]"
              rows={1}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-md sm:h-7 sm:w-7"
              disabled={!input.trim() || isSending}
              onClick={() => {
                void handleSend();
              }}
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          {error && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-[11px] text-destructive/80">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {activeConversationId && (
            <p className="mt-2 hidden text-[10px] text-muted-foreground/25 sm:block">
              Conversation #{activeConversationId} is saved automatically. Helpers stay available, but only answer when tagged or when the lead agent consults them.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  agentId,
  onShortcutClick,
}: {
  agentId: string;
  onShortcutClick: (text: string) => void;
}) {
  const agent = AGENTS.find((item) => item.id === agentId) || AGENTS[0];
  const shortcuts = SHORTCUTS[agentId] || SHORTCUTS.generalist;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-start px-4 pt-12 text-center sm:justify-center sm:pt-0"
    >
      <Sparkles className="mb-3 h-5 w-5 text-muted-foreground/20" />
      <h2 className="text-[15px] font-medium text-foreground sm:text-[15px]">
        Start with a question or a result to review
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground/50">
        You're chatting with <span className={cn(agent.color)}>{agent.name}</span>
      </p>

      <div className="mt-5 flex w-full max-w-md flex-col gap-2 sm:mt-6 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut}
            onClick={() => onShortcutClick(shortcut)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 bg-card/30 px-3 py-2 text-[12px] text-muted-foreground/60 transition-colors hover:border-border hover:bg-card/60 hover:text-foreground sm:w-auto sm:justify-start sm:py-1.5"
          >
            <ArrowRight className="h-3 w-3" />
            {shortcut}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  const agent = AGENTS.find((item) => item.id === message.agentId);
  const calledAgents = message.metadata?.calledAgents;
  const consultedAgentNames = message.metadata?.consultedAgentNames;
  const relatedVaultFiles = message.metadata?.relatedVaultFiles ?? [];
  const note = message.metadata?.note;
  const responseMode = message.metadata?.responseMode;
  const consultationMode = message.metadata?.consultationMode;
  const consultationReason = message.metadata?.consultationReason;
  const contextSummary = message.metadata?.contextSummary;
  const missingContext = message.metadata?.missingContext ?? [];
  const executionNotes = message.metadata?.executionNotes ?? [];
  const providerSlug = message.metadata?.providerSlug;
  const modelName = message.metadata?.modelName;
  const requestedProviderSlug = message.metadata?.requestedProviderSlug;
  const requestedModelName = message.metadata?.requestedModelName;
  const inputTokens = message.metadata?.inputTokens;
  const outputTokens = message.metadata?.outputTokens;
  const hasExplainability =
    Boolean(consultationReason) ||
    Boolean(contextSummary) ||
    missingContext.length > 0 ||
    executionNotes.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
          isUser ? "bg-muted text-muted-foreground/60" : "bg-muted text-muted-foreground/40",
        )}
      >
        {isUser ? "A" : <Sparkles className="h-3 w-3" />}
      </div>

      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/40">
            {isUser ? "You" : agent?.name || "Aura"}
          </span>
          {!isUser && isStreaming && (
            <span className="text-[10px] text-sky-200/70">writing...</span>
          )}
          {calledAgents && calledAgents.length > 0 && (
            <span className="text-[10px] text-muted-foreground/20">
              +{calledAgents.length} consulted
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/25">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className={cn("text-[13px] leading-relaxed", isUser ? "text-foreground" : "text-foreground/90")}>
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
        {!isUser && isStreaming && (
          <div className="mt-1 h-4 w-1 rounded-full bg-sky-300/70 animate-pulse" />
        )}

        {!isUser && (
          <>
            {(note ||
              relatedVaultFiles.length > 0 ||
              responseMode === "limited" ||
              (consultedAgentNames && consultedAgentNames.length > 0) ||
              consultationMode === "explicit" ||
              consultationMode === "auto") && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {note && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2 py-0.5 text-[10px] text-muted-foreground/55">
                    <Info className="h-3 w-3" />
                    {note}
                  </span>
                )}
                {consultedAgentNames && consultedAgentNames.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2 py-0.5 text-[10px] text-muted-foreground/55">
                    <Sparkles className="h-3 w-3" />
                    Consulted: {consultedAgentNames.join(", ")}
                  </span>
                )}
                {consultationMode && consultationMode !== "none" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/5 px-2 py-0.5 text-[10px] text-sky-200/80">
                    <Sparkles className="h-3 w-3" />
                    {consultationMode === "explicit"
                      ? "Explicit consult"
                      : "Auto consult"}
                  </span>
                )}
                {providerSlug && modelName && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2 py-0.5 text-[10px] text-muted-foreground/55">
                    <Sparkles className="h-3 w-3" />
                    {providerSlug} | {modelName}
                  </span>
                )}
                {requestedProviderSlug &&
                  (requestedProviderSlug !== providerSlug ||
                    (requestedModelName && requestedModelName !== modelName)) && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-200/80">
                      <Info className="h-3 w-3" />
                      Requested {requestedProviderSlug}
                      {requestedModelName ? ` | ${requestedModelName}` : ""}
                    </span>
                  )}
                {typeof inputTokens === "number" &&
                  typeof outputTokens === "number" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] text-emerald-200/80">
                      Tokens: {inputTokens} in | {outputTokens} out
                    </span>
                  )}
                {relatedVaultFiles.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2 py-0.5 text-[10px] text-muted-foreground/55">
                    <Files className="h-3 w-3" />
                    {relatedVaultFiles.length} vault file
                    {relatedVaultFiles.length > 1 ? "s" : ""} used
                  </span>
                )}
                {responseMode === "limited" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[10px] text-amber-200/80">
                    Limited mode
                  </span>
                )}
              </div>
            )}
            {hasExplainability && (
              <details className="mt-2 max-w-full rounded-lg border border-border/30 bg-card/20 px-3 py-2 text-[11px] text-muted-foreground/55">
                <summary className="cursor-pointer list-none text-[11px] text-muted-foreground/45">
                  How Aura built this answer
                </summary>
                <div className="mt-2 space-y-2">
                  {consultationReason && <p>{consultationReason}</p>}
                  {contextSummary && <p>Context: {contextSummary}</p>}
                  {missingContext.length > 0 && (
                    <div>
                      <p className="mb-1 text-muted-foreground/35">Missing context</p>
                      <ul className="space-y-1 pl-4">
                        {missingContext.map((item) => (
                          <li key={item} className="list-disc">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {executionNotes.length > 0 && (
                    <div>
                      <p className="mb-1 text-muted-foreground/35">Execution notes</p>
                      <ul className="space-y-1 pl-4">
                        {executionNotes.map((item) => (
                          <li key={item} className="list-disc">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </details>
            )}
            <div className="mt-1 flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50"
                onClick={() => {
                  void navigator.clipboard.writeText(message.content);
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50">
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50">
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function ThinkingBubble({
  agentName,
  stages,
  currentStageIndex,
}: {
  agentName: string;
  stages: PendingTurnStage[];
  currentStageIndex: number;
}) {
  const activeStage =
    stages[currentStageIndex] ?? stages[0] ?? { id: "draft", label: "Analyzing your message" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
        <Sparkles className="h-3 w-3" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/40">{agentName}</span>
          <span className="text-[10px] text-muted-foreground/25">working...</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/30 px-3 py-2 text-[12px] text-muted-foreground/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {activeStage.label}
        </div>
        {stages.length > 1 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {stages.map((stage, index) => (
              <span
                key={stage.id}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                  index < currentStageIndex
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200/70"
                    : index === currentStageIndex
                      ? "border-sky-500/20 bg-sky-500/5 text-sky-200/80"
                      : "border-border/30 bg-card/20 text-muted-foreground/35",
                )}
              >
                {stage.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

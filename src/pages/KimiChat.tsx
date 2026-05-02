import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  Brain,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useKimiChatData } from "@/hooks/useKimiChatData";
import { useChatStore } from "@/hooks/useStore";
import { AGENTS } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";

const allIcons: Record<string, React.ReactNode> = {
  Brain: <Brain className="h-3.5 w-3.5" />,
  Sparkles: <Sparkles className="h-3.5 w-3.5" />,
};

type KimiMetadata = Message["metadata"] & {
  thinkingMode?: "enabled" | "disabled";
  memoryApplied?: boolean;
  toolCalls?: string[];
  toolResults?: string[];
  promptCacheKey?: string;
  finishReason?: string | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedTokens?: number;
  };
};

const SHORTCUTS = [
  "Resumime esta conversacion en bullets",
  "Ayudame a ordenar esta idea paso a paso",
  "Dame una respuesta corta y clara para este problema",
];

export default function KimiChat() {
  const activeAgentId = useChatStore(state => state.activeAgentId);
  const clearChat = useChatStore(state => state.clearChat);
  const {
    messages,
    isConversationLoading,
    isSending,
    error,
    startNewChat,
    sendMessage,
    runBackendCheck,
  } = useKimiChatData();

  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeAgent = AGENTS.find(agent => agent.id === activeAgentId) ?? AGENTS[0];

  const displayedMessages = useMemo(() => messages, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [displayedMessages, pendingUserMessage, scrollToBottom]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) {
      return;
    }

    const content = input.trim();
    setPendingUserMessage(content);
    setInput("");

    try {
      await sendMessage(content);
    } finally {
      setPendingUserMessage(null);
    }
  }, [input, isSending, sendMessage]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-[1500px] min-w-0 flex-col overflow-hidden p-3 sm:p-4 lg:p-5">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border/40 bg-card/20">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/35">
                Kimi chat
              </p>
              <div className="mt-1 flex items-center gap-2 text-[14px] text-foreground">
                <span className={cn("text-amber-200/85", activeAgent.color)}>
                  {allIcons[activeAgent.icon] ?? <Sparkles className="h-3.5 w-3.5" />}
                </span>
                <span className="truncate">{activeAgent.name}</span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-emerald-100/70">
                  Simple
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground/45">
                Mensaje directo a Kimi desde backend simple, sin orquestacion extra.
              </p>
            </div>
            <div className="flex items-center gap-2">
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

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {isConversationLoading ? (
              <LoadingState label="Loading Kimi conversation" />
            ) : displayedMessages.length === 0 && !pendingUserMessage ? (
              <EmptyState
                onShortcutClick={setInput}
                onRunCheck={() => {
                  void runBackendCheck();
                }}
                isSending={isSending}
              />
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {displayedMessages.map(message => (
                  <KimiMessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={message.id === "kimi-streaming"}
                  />
                ))}
                {pendingUserMessage && (
                  <KimiMessageBubble
                    message={{
                      id: "pending-user",
                      role: "user",
                      content: pendingUserMessage,
                      agentId: activeAgentId,
                      timestamp: new Date(),
                    }}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t border-border/30 bg-background/70 px-4 py-4 backdrop-blur">
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
                placeholder="Escribile a Kimi..."
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

function EmptyState({
  onShortcutClick,
  onRunCheck,
  isSending,
}: {
  onShortcutClick: (value: string) => void;
  onRunCheck: () => void;
  isSending: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Sparkles className="h-6 w-6 text-amber-200/70" />
      <h2 className="mt-4 text-[18px] font-medium text-foreground">
        Kimi chat listo
      </h2>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground/45">
        Esta vista envia un mensaje simple a Kimi y guarda el intercambio en el navegador.
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
      <button
        onClick={onRunCheck}
        disabled={isSending}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-[11px] text-emerald-100/80 transition-colors hover:bg-emerald-400/15 disabled:opacity-60"
      >
        {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Test backend Kimi
      </button>
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

        {!isUser && metadata && (
          <div className="flex flex-wrap gap-2">
            <MetaPill icon={<Sparkles className="h-3 w-3" />}>
              {metadata.providerSlug ?? "kimi"} | {metadata.modelName ?? "kimi-k2.6"}
            </MetaPill>
            {metadata.thinkingMode && (
              <MetaPill icon={<Brain className="h-3 w-3" />}>
                thinking {metadata.thinkingMode}
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

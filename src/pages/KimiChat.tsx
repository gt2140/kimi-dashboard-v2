import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Brain, Loader2, Send, Sparkles } from "lucide-react";
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
    activeConversationId,
    isConversationLoading,
    isSending,
    error,
    startNewChat,
    sendMessage,
    retryLastTurn,
  } = useKimiChatData();

  const [input, setInput] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [autoRetryConversationId, setAutoRetryConversationId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeAgent = AGENTS.find(agent => agent.id === activeAgentId) ?? AGENTS[0];

  const displayedMessages = useMemo(() => messages, [messages]);
  const hasPendingAssistantReply =
    displayedMessages.length > 0 &&
    displayedMessages[displayedMessages.length - 1]?.role === "user" &&
    !isSending;

  useEffect(() => {
    if (
      !hasPendingAssistantReply ||
      isSending ||
      activeConversationId === null ||
      autoRetryConversationId === activeConversationId
    ) {
      return;
    }

    setAutoRetryConversationId(activeConversationId);
    void retryLastTurn().catch(() => undefined);
  }, [
    activeConversationId,
    autoRetryConversationId,
    hasPendingAssistantReply,
    isSending,
    retryLastTurn,
  ]);

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
            <div className="flex items-center gap-2 text-[15px] text-foreground sm:text-[16px]">
              <span className={cn("text-amber-200/85", activeAgent.color)}>
                {allIcons[activeAgent.icon] ?? <Sparkles className="h-3.5 w-3.5" />}
              </span>
              <span className="truncate">Kimi Chat</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-muted-foreground/45">
              {activeAgent.name}
            </p>
          </div>
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isConversationLoading ? (
            <LoadingState label="Loading chat" />
          ) : displayedMessages.length === 0 && !pendingUserMessage ? (
            <EmptyState onShortcutClick={setInput} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
              {hasPendingAssistantReply && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-[12px] text-amber-100/85">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>The last reply did not finish. You can retry it.</span>
                    <button
                      onClick={() => {
                        void retryLastTurn();
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-amber-300/25 px-3 py-1.5 text-[11px] transition-colors hover:bg-amber-300/10"
                    >
                      Retry reply
                    </button>
                  </div>
                </div>
              )}
              {displayedMessages.map(message => (
                <KimiMessageBubble key={message.id} message={message} />
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
          {error && <p className="mt-2 text-[12px] text-destructive/80">{error}</p>}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ onShortcutClick }: { onShortcutClick: (value: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <Sparkles className="h-6 w-6 text-amber-200/70" />
      <h2 className="mt-4 text-[18px] font-medium text-foreground">Start a chat</h2>
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

function KimiMessageBubble({ message }: { message: Message }) {
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

        {!isUser && metadata?.thinkingMode && (
          <div className="flex flex-wrap gap-2">
            <MetaPill icon={<Brain className="h-3 w-3" />}>
              thinking {metadata.thinkingMode}
            </MetaPill>
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

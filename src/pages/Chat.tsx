import { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { useChatStore } from "@/hooks/useStore";
import { useChatData } from "@/hooks/useChatData";
import { AGENTS } from "@/lib/data";
import type { Message } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  generalist: ["Analyze latest bloodwork", "Explain DEXA scan", "Review genetic variants"],
  bloodwork: ["Optimize lipid panel", "Interpret hormone levels", "Check inflammation markers"],
  nutrition: ["Build meal plan", "Optimize macros", "Training day timing"],
  supplements: ["Review current stack", "Check interactions", "Sleep optimization"],
  peptides: ["BPC-157 protocol", "TB-500 dosing", "Safety monitoring"],
  psychedelics: ["Microdosing schedule", "Safety screening", "Integration practices"],
};

export default function Chat() {
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
    sendMessage,
    startNewChat,
  } = useChatData();

  const [input, setInput] = useState("");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeAgent = AGENTS.find((agent) => agent.id === activeAgentId) || AGENTS[0];

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) {
      return;
    }

    const content = input.trim();
    setInput("");
    await sendMessage(content);
  }, [input, isSending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSend();
    }
  };

  const availableAgents = AGENTS.filter(
    (agent) => agent.id !== activeAgentId && !calledAgentIds.includes(agent.id),
  );

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-3">
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
              className="flex items-center gap-1 rounded-md border border-border/40 bg-card/30 px-2.5 py-1.5 text-[11px] text-muted-foreground/50 hover:text-foreground hover:border-border/60 transition-all"
            >
              <Plus className="h-3 w-3" /> Call agent
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
                    Available agents
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
                      All agents called
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
            className="text-[11px] text-muted-foreground/30 hover:text-foreground transition-colors px-2"
          >
            New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
        {isConversationLoading ? (
          <div className="flex h-full items-center justify-center text-[12px] text-muted-foreground/40">
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Loading conversation...
          </div>
        ) : messages.length === 0 ? (
          <EmptyState
            agentId={activeAgentId}
            onShortcutClick={(text) => setInput(text)}
          />
        ) : (
          <div className="mx-auto max-w-2xl space-y-8">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border/60 px-6 py-4">
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
                    {allIcons[agent.icon]} {agent.name} assisting
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-lg border border-border/60 bg-card/30 p-2.5 focus-within:border-border focus-within:bg-card/60 transition-colors">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${activeAgent.allowedVaultCategories.join(", ")}...`}
              className="min-h-[36px] resize-none border-0 bg-transparent p-0 text-[13px] leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/30"
              rows={1}
            />
            <Button
              size="icon"
              className="h-7 w-7 shrink-0 rounded-md"
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
            <p className="mt-2 text-[11px] text-destructive/80">
              Chat error: {error}
            </p>
          )}
          {activeConversationId && (
            <p className="mt-2 text-[10px] text-muted-foreground/25">
              Conversation #{activeConversationId} is saved automatically.
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
      className="flex h-full flex-col items-center justify-center px-4"
    >
      <Sparkles className="mb-4 h-5 w-5 text-muted-foreground/20" />
      <h2 className="text-[15px] font-medium text-foreground">
        What would you like to know?
      </h2>
      <p className="mt-1 text-[12px] text-muted-foreground/50">
        Speaking with <span className={cn(agent.color)}>{agent.name}</span>
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut}
            onClick={() => onShortcutClick(shortcut)}
            className="flex items-center gap-1.5 rounded-md border border-border/60 bg-card/30 px-3 py-1.5 text-[12px] text-muted-foreground/60 transition-colors hover:text-foreground hover:border-border hover:bg-card/60"
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
}: {
  message: Message;
}) {
  const isUser = message.role === "user";
  const agent = AGENTS.find((item) => item.id === message.agentId);
  const calledAgents = message.metadata?.calledAgents;

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
          {calledAgents && calledAgents.length > 0 && (
            <span className="text-[10px] text-muted-foreground/20">
              +{calledAgents.length} assisting
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

        {!isUser && (
          <div className="mt-1 flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50">
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50">
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50">
              <ThumbsDown className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

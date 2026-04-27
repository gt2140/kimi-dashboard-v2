import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Loader2, Copy, ThumbsUp, ThumbsDown,
  Sparkles, ArrowRight, Plus, X, Brain, Droplets, Apple,
  Pill, Flower2, Save
} from "lucide-react";
import { useChatStore, getActiveAgent } from "@/hooks/useStore";
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

const MOCK_RESPONSES: Record<string, string[]> = {
  generalist: [
    "Based on your recent bloodwork, your metabolic markers are well within optimal ranges. Your glucose of 92 mg/dL and HbA1c at 5.1% suggest excellent glycemic control.\n\n| Marker | Your Value | Optimal | Status |\n|--------|-----------|---------|--------|\n| Glucose | 92 | 70-100 | Optimal |\n| HbA1c | 5.1% | <5.7% | Optimal |\n| LDL | 118 | <100 | Borderline |\n| HDL | 68 | >40 | Optimal |",
    "I've reviewed your body composition DEXA scan. Your lean mass is well-preserved at 72.3 kg with a body fat percentage of 14.2%, which is excellent for your age group.\n\nKey observations:\n- Visceral adipose tissue: 89 cm² (optimal <100)\n- Bone mineral density: 1.12 g/cm² (normal range)\n- Appendicular lean mass index: 8.4 kg/m²",
    "Your genetic report shows several interesting variants:\n\n1. **CYP1A2** (rs762551) — AA genotype: Fast caffeine metabolizer\n2. **APOE** — ε3/ε3: Average cardiovascular risk profile\n3. **MTHFR** C677T — CT heterozygote: Consider methylated B-vitamins\n4. **FTO** — Risk allele carrier: Slightly higher BMI susceptibility, manageable with exercise",
  ],
  bloodwork: [
    "Looking at your lipid panel in detail:\n\n| Lipid Marker | Value | Optimal | Interpretation |\n|-------------|-------|---------|----------------|\n| Total Cholesterol | 195 | <200 | Good |\n| LDL-C | 118 | <100 | Slightly elevated |\n| HDL-C | 68 | >40 | Excellent |\n| Triglycerides | 78 | <150 | Excellent |\n| Non-HDL-C | 127 | <130 | Good |\n\nLDL particle number would be helpful here. Pattern A (large buoyant) vs Pattern B (small dense) makes a significant difference in cardiovascular risk despite similar LDL-C values.",
    "Your inflammatory markers are excellent:\n\n- **hs-CRP**: 0.4 mg/L (very low cardiovascular risk)\n- **Homocysteine**: 8.2 umol/L (optimal, suggests good methylation status)\n- **Ferritin**: 145 ng/mL (good range, not suggestive of iron overload or deficiency)\n\nThese values suggest low systemic inflammation and good methylation capacity.",
  ],
  nutrition: [
    "Based on your wearable data and bloodwork, here's an optimized nutrition protocol:\n\n**Macronutrient Targets:**\n- Protein: 1.8g/kg bodyweight = 145g/day\n- Carbs: 180-220g (training days), 120-150g (rest days)\n- Fats: 70-80g, emphasizing omega-3s\n\n**Timing:**\n- Pre-workout: 30g carbs + 10g EAAs\n- Post-workout: 40g protein within 2 hours\n- Evening: Lower carb, higher fat for sleep quality\n\n**Micronutrient focus based on labs:**\n- Vitamin D: Already optimal at 42 ng/mL, maintain current dose\n- Consider adding 200mg magnesium glycinate before bed",
  ],
  supplements: [
    "Reviewing your current supplement stack against your biomarkers:\n\n**Keep:**\n- Vitamin D3 (maintaining 42 ng/mL)\n- Omega-3 (supporting your excellent triglyceride/HDL ratio)\n- Creatine monohydrate (5g daily)\n\n**Consider adding:**\n- Magnesium glycinate 200mg PM (supports sleep, not directly tested but likely beneficial given activity levels)\n- Methylated B-complex (given MTHFR heterozygous status)\n\n**Reconsider:**\n- Generic B-complex → Switch to methylated forms\n- Zinc if >30mg daily (may affect copper balance long-term)",
  ],
  peptides: [
    "Regarding peptide protocols for recovery and longevity:\n\n**BPC-157 (Body Protection Compound):**\n- Typical dosing: 250-500mcg daily, subcutaneous near injury site\n- Cycle: 4-6 weeks on, 4 weeks off\n- Monitoring: Check inflammatory markers (hs-CRP, ESR) before and after\n\n**TB-500 (Thymosin Beta-4):**\n- Typical dosing: 2-2.5mg twice weekly\n- Often stacked with BPC-157 for synergistic tissue repair\n\nImportant considerations:\n- These are research compounds, not approved for human use in many jurisdictions\n- Source quality is critical — third-party testing essential\n- Your current hs-CRP of 0.4 suggests low baseline inflammation, which is a good starting point",
  ],
  psychedelics: [
    "Regarding psychedelic-assisted protocols:\n\n**Safety Screening Checklist:**\n- No personal/family history of psychosis, bipolar I, or schizophrenia ✅\n- No current SSRI/SNRI use (important for MDMA, less for psilocybin)\n- Cardiovascular screening if considering MDMA\n- Set and setting preparation essential\n\n**Microdosing Protocol (Psilocybin):**\n- Dose: 50-100mg dried mushroom (sub-perceptual)\n- Schedule: Fadiman protocol (1 day on, 2 days off) or Stamets protocol (4 days on, 3 off)\n- Duration: 4-8 weeks with integration breaks\n\n**Macrodose Considerations:**\n- 2-3g psilocybin with trained facilitator recommended for therapeutic work\n- Integration support (therapy, journaling) critical for lasting benefits\n- Your stable baseline (low hs-CRP, balanced hormones) suggests good physiological readiness",
  ],
};

const SHORTCUTS: Record<string, string[]> = {
  generalist: ["Analyze latest bloodwork", "Explain DEXA scan", "Review genetic variants"],
  bloodwork: ["Optimize lipid panel", "Interpret hormone levels", "Check inflammation markers"],
  nutrition: ["Build meal plan", "Optimize macros", "Training day timing"],
  supplements: ["Review current stack", "Check interactions", "Sleep optimization"],
  peptides: ["BPC-157 protocol", "TB-500 dosing", "Safety monitoring"],
  psychedelics: ["Microdosing schedule", "Safety screening", "Integration practices"],
};

function getMockResponse(agentId: string): string {
  const responses = MOCK_RESPONSES[agentId] || MOCK_RESPONSES.generalist;
  return responses[Math.floor(Math.random() * responses.length)];
}

export default function Chat() {
  const activeAgentId = useChatStore((state) => state.activeAgentId);
  const calledAgentIds = useChatStore((state) => state.calledAgentIds);
  const messages = useChatStore((state) => state.messages);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const streamingContent = useChatStore((state) => state.streamingContent);
  const addMessage = useChatStore((state) => state.addMessage);
  const setStreaming = useChatStore((state) => state.setStreaming);
  const appendStreamingContent = useChatStore((state) => state.appendStreamingContent);
  const finishStreaming = useChatStore((state) => state.finishStreaming);
  const clearChat = useChatStore((state) => state.clearChat);
  const saveSession = useChatStore((state) => state.saveSession);
  const callAgent = useChatStore((state) => state.callAgent);
  const removeCalledAgent = useChatStore((state) => state.removeCalledAgent);

  const [input, setInput] = useState("");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeAgent = getActiveAgent();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingContent, scrollToBottom]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      agentId: activeAgentId,
      timestamp: new Date(),
      metadata: { calledAgents: calledAgentIds.length > 0 ? calledAgentIds : undefined },
    };

    addMessage(userMessage);
    setInput("");
    setStreaming(true);

    const response = getMockResponse(activeAgentId);
    let index = 0;
    const interval = setInterval(() => {
      if (index < response.length) {
        const chunkSize = Math.floor(Math.random() * 3) + 1;
        const chunk = response.slice(index, index + chunkSize);
        appendStreamingContent(chunk);
        index += chunkSize;
      } else {
        clearInterval(interval);
        finishStreaming();
      }
    }, 15 + Math.random() * 25);
  }, [input, isStreaming, activeAgentId, calledAgentIds, addMessage, setStreaming, appendStreamingContent, finishStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const availableAgents = AGENTS.filter((a) => a.id !== activeAgentId && !calledAgentIds.includes(a.id));

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Agent Header */}
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
                  const agent = AGENTS.find((a) => a.id === id);
                  if (!agent) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => removeCalledAgent(id)}
                      className={cn("flex items-center gap-1 rounded-full border border-border/40 bg-card/30 px-2 py-0.5 text-[10px] hover:border-destructive/30 transition-colors", agent.color)}
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
                  <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/30">Available agents</p>
                  {availableAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => { callAgent(agent.id); setShowAgentPicker(false); }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors text-left"
                    >
                      <span className={agent.color}>{allIcons[agent.icon]}</span>
                      <span>{agent.name}</span>
                    </button>
                  ))}
                  {availableAgents.length === 0 && (
                    <p className="px-2 py-2 text-[11px] text-muted-foreground/25">All agents called</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {messages.length > 0 && (
            <>
              <button onClick={() => saveSession()} className="text-[11px] text-muted-foreground/30 hover:text-foreground transition-colors flex items-center gap-1 px-2">
                <Save className="h-3 w-3" /> Save
              </button>
              <button onClick={clearChat} className="text-[11px] text-muted-foreground/30 hover:text-foreground transition-colors px-2">New</button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
        {messages.length === 0 && !isStreaming ? (
          <EmptyState agentId={activeAgentId} onShortcutClick={(text) => setInput(text)} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-8">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingContent,
                  agentId: activeAgentId,
                  timestamp: new Date(),
                }}
                isStreaming
              />
            )}
            {isStreaming && !streamingContent && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground/40">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analyzing...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/60 px-6 py-4">
        <div className="mx-auto max-w-2xl">
          {calledAgentIds.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {calledAgentIds.map((id) => {
                const agent = AGENTS.find((a) => a.id === id);
                if (!agent) return null;
                return (
                  <span key={id} className={cn("flex items-center gap-1 rounded-full border border-border/30 bg-card/20 px-2 py-0.5 text-[10px]", agent.color)}>
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
              disabled={!input.trim() || isStreaming}
              onClick={handleSend}
            >
              {isStreaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ agentId, onShortcutClick }: { agentId: string; onShortcutClick: (text: string) => void }) {
  const agent = AGENTS.find((a) => a.id === agentId) || AGENTS[0];
  const shortcuts = SHORTCUTS[agentId] || SHORTCUTS.generalist;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center px-4"
    >
      <Sparkles className="h-5 w-5 text-muted-foreground/20 mb-4" />
      <h2 className="text-[15px] font-medium text-foreground">What would you like to know?</h2>
      <p className="mt-1 text-[12px] text-muted-foreground/50">
        Speaking with <span className={cn(agent.color)}>{agent.name}</span>
        {agent.id === "generalist" && <span className="text-muted-foreground/30"> — use <strong>Call agent</strong> to bring in specialists</span>}
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

function MessageBubble({ message, isStreaming = false }: { message: Message; isStreaming?: boolean }) {
  const isUser = message.role === "user";
  const agent = AGENTS.find((a) => a.id === message.agentId);
  const calledAgents = message.metadata?.calledAgents;

  return (
    <motion.div
      initial={isStreaming ? undefined : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium", isUser ? "bg-muted text-muted-foreground/60" : "bg-muted text-muted-foreground/40")}>
        {isUser ? "A" : <Sparkles className="h-3 w-3" />}
      </div>

      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/40">
            {isUser ? "You" : agent?.name || "Aura"}
          </span>
          {calledAgents && calledAgents.length > 0 && (
            <span className="text-[10px] text-muted-foreground/20">+{calledAgents.length} assisting</span>
          )}
          <span className="text-[10px] text-muted-foreground/25">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        <div className={cn("text-[13px] leading-relaxed", isUser ? "text-foreground" : "text-foreground/90")}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {!isUser && !isStreaming && (
          <div className="flex items-center gap-0.5 mt-1">
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50"><Copy className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50"><ThumbsUp className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground/25 hover:text-muted-foreground/50"><ThumbsDown className="h-3 w-3" /></Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

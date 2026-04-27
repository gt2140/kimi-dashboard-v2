import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, CheckCircle2, Zap, Pickaxe,
  ChevronDown, ChevronUp, Star, Hash, Coins, X,
  Target, Users, Award, BarChart3
} from "lucide-react";
import { usePredictionsStore, useProfileStore } from "@/hooks/useStore";
import type { Prediction } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Predictions() {
  const predictions = usePredictionsStore((s) => s.predictions);
  const respondToPrediction = usePredictionsStore((s) => s.respondToPrediction);
  const voteResponse = usePredictionsStore((s) => s.voteResponse);
  const balance = useProfileStore((s) => s.balance);
  const [tab, setTab] = useState<"active" | "resolved" | "mine">("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [responseText, setResponseText] = useState<Record<string, string>>({});

  const activePreds = predictions.filter((p) => p.status === "open" || p.status === "in-progress");
  const resolvedPreds = predictions.filter((p) => p.status === "resolved");
  const myPreds = predictions.filter((p) => p.createdBy === "Alex");
  const totalResponses = predictions.reduce((acc, p) => acc + p.responses.length, 0);
  const totalRewards = activePreds.reduce((acc, p) => acc + p.rewardTokens, 0);

  const filtered = tab === "active" ? activePreds : tab === "resolved" ? resolvedPreds : myPreds;

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 p-4 sm:p-6 lg:p-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-[20px] font-medium tracking-tight text-foreground">Proof of Health</h1>
            <p className="text-[12px] text-muted-foreground/40 mt-1">Prediction markets for health intelligence. Miners compete to produce the best analysis.</p>
          </div>
          <span className="text-[12px] text-muted-foreground/40">{balance.aura.toLocaleString()} AURA</span>
        </div>
      </motion.div>

      {/* Stats Dashboard */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox icon={<Target className="h-4 w-4" />} label="Active Pools" value={activePreds.length} />
        <StatBox icon={<Pickaxe className="h-4 w-4" />} label="Total Hashes" value={totalResponses} />
        <StatBox icon={<Coins className="h-4 w-4" />} label="Rewards Locked" value={`${totalRewards} AURA`} accent />
        <StatBox icon={<Users className="h-4 w-4" />} label="Miners Active" value={12} />
      </motion.div>

      {/* Tabs + Create */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/30 w-fit">
          {(["active", "resolved", "mine"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12px] font-medium capitalize transition-all",
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/40 hover:text-muted-foreground/60"
              )}
            >
              {t === "active" ? `Active Pools (${activePreds.length})` : t === "resolved" ? `Resolved (${resolvedPreds.length})` : `My Pools (${myPreds.length})`}
            </button>
          ))}
        </div>
        <Button size="sm" className="h-7 text-[11px] gap-1 w-fit" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-3 w-3" /> Create Pool
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && <CreatePoolForm onClose={() => setShowCreate(false)} />}
      </AnimatePresence>

      {/* Pools Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map((pred) => (
          <PoolCard
            key={pred.id}
            pred={pred}
            expanded={expandedId === pred.id}
            onToggle={() => setExpandedId(expandedId === pred.id ? null : pred.id)}
            responseText={responseText[pred.id] || ""}
            onResponseChange={(v) => setResponseText({ ...responseText, [pred.id]: v })}
            onSubmitResponse={(text) => {
              respondToPrediction(pred.id, {
                id: `resp-${Date.now()}`,
                predictionId: pred.id,
                responderId: "alex",
                responderName: "Alex",
                content: text,
                confidence: 0.85,
                votes: 0,
                createdAt: new Date(),
                status: "pending",
              });
              setResponseText({ ...responseText, [pred.id]: "" });
            }}
            onVote={(rid) => voteResponse(pred.id, rid)}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Pickaxe className="h-8 w-8 mx-auto text-muted-foreground/15 mb-3" />
          <p className="text-[13px] text-muted-foreground/40">No pools found</p>
        </div>
      )}
    </div>
  );
}

function StatBox({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border/40 bg-card/20 px-4 py-3", accent && "border-amber-500/10 bg-amber-500/[0.03]")}>
      <div className="flex items-center gap-2 text-muted-foreground/30 mb-1">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className={cn("text-[18px] font-medium", accent ? "text-amber-400/80" : "text-foreground")}>{value}</p>
    </div>
  );
}

function PoolCard({
  pred, expanded, onToggle, responseText, onResponseChange, onSubmitResponse, onVote
}: {
  pred: Prediction;
  expanded: boolean;
  onToggle: () => void;
  responseText: string;
  onResponseChange: (v: string) => void;
  onSubmitResponse: (text: string) => void;
  onVote: (rid: string) => void;
}) {
  const isOpen = pred.status === "open" || pred.status === "in-progress";

  return (
    <div className="rounded-xl border border-border/30 bg-card/20 overflow-hidden transition-all hover:border-border/50">
      <button onClick={onToggle} className="w-full px-4 py-3 text-left">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5", isOpen ? "bg-amber-500/10 text-amber-400/60" : "bg-emerald-500/10 text-emerald-400/60")}>
            {isOpen ? <Zap className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-foreground truncate">{pred.title}</p>
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-border/30 text-muted-foreground/40 shrink-0">{pred.category}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground/40 mt-0.5 line-clamp-1">{pred.description}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[11px] text-amber-400/60 font-medium">{pred.rewardTokens} AURA</span>
              <span className="text-[11px] text-muted-foreground/30 flex items-center gap-1">
                <Hash className="h-3 w-3" /> {pred.responses.length} hashes
              </span>
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", isOpen ? "bg-amber-500/10 text-amber-400/60" : "bg-emerald-500/10 text-emerald-400/60")}>
                {isOpen ? "Mining" : "Claimed"}
              </span>
            </div>
          </div>
          <div className="shrink-0 mt-1">
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/20" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/20" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4 border-t border-border/20 pt-3">
              {/* Objective & Validation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/20 bg-card/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40 mb-1">Objective</p>
                  <p className="text-[12px] text-foreground/80">{pred.objective}</p>
                </div>
                <div className="rounded-lg border border-border/20 bg-card/30 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40 mb-1">Validation</p>
                  <p className="text-[12px] text-foreground/60">{pred.validationCriteria}</p>
                </div>
              </div>

              {/* Leaderboard */}
              {pred.responses.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/40 flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" /> Leaderboard
                    </p>
                    <span className="text-[10px] text-muted-foreground/30">{pred.responses.length} submissions</span>
                  </div>
                  <div className="space-y-1.5">
                    {pred.responses
                      .sort((a, b) => b.votes - a.votes)
                      .map((resp, idx) => (
                        <div
                          key={resp.id}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                            idx === 0 ? "border-amber-500/15 bg-amber-500/[0.03]" : "border-border/20 bg-card/30"
                          )}
                        >
                          <div className="flex flex-col items-center shrink-0 w-5">
                            {idx === 0 && <Award className="h-4 w-4 text-amber-400/60" />}
                            <span className={cn("text-[10px] font-medium", idx === 0 ? "text-amber-400/60" : "text-muted-foreground/30")}>#{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-medium text-foreground">{resp.responderName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground/30">{(resp.confidence * 100).toFixed(0)}% confidence</span>
                                <button onClick={() => onVote(resp.id)} className="flex items-center gap-0.5 text-[10px] text-muted-foreground/30 hover:text-amber-400 transition-colors">
                                  <Star className="h-2.5 w-2.5" /> {resp.votes}
                                </button>
                              </div>
                            </div>
                            <p className="text-[12px] text-foreground/70">{resp.content}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Submit Hash */}
              {isOpen && (
                <div className="flex gap-2">
                  <Input
                    value={responseText}
                    onChange={(e) => onResponseChange(e.target.value)}
                    placeholder="Submit your analysis (hash)..."
                    className="h-9 text-[12px] bg-card/30 border-border/30"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && responseText.trim()) {
                        e.preventDefault();
                        onSubmitResponse(responseText.trim());
                      }
                    }}
                  />
                  <Button size="sm" className="h-9 px-4" disabled={!responseText.trim()} onClick={() => onSubmitResponse(responseText.trim())}>
                    <Pickaxe className="h-3.5 w-3.5 mr-1" /> Mine
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreatePoolForm({ onClose }: { onClose: () => void }) {
  const createPrediction = usePredictionsStore((s) => s.createPrediction);
  const spendTokens = useProfileStore((s) => s.spendTokens);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [criteria, setCriteria] = useState("");
  const [reward, setReward] = useState("100");
  const [category, setCategory] = useState("General");

  const handleSubmit = () => {
    const tokens = parseInt(reward) || 100;
    createPrediction({
      id: `pred-${Date.now()}`,
      title,
      description: objective,
      objective,
      validationCriteria: criteria,
      rewardTokens: tokens,
      status: "open",
      createdBy: "Alex",
      createdAt: new Date(),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      category,
      responses: [],
    });
    spendTokens(tokens);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-4 rounded-xl border border-border/40 bg-card/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-foreground">New Mining Pool</p>
        <button onClick={onClose} className="text-muted-foreground/30 hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pool title" className="h-8 text-[12px] bg-card/30 border-border/30" />
      <textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="What analysis do you need?" className="w-full h-16 rounded-md border border-border/30 bg-card/30 p-2 text-[12px] resize-none focus:outline-none focus:border-border/60" />
      <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="How will the best response be validated?" className="w-full h-16 rounded-md border border-border/30 bg-card/30 p-2 text-[12px] resize-none focus:outline-none focus:border-border/60" />
      <div className="flex gap-2">
        <Input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Reward (AURA)" className="h-8 text-[12px] bg-card/30 border-border/30 w-32" />
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" className="h-8 text-[12px] bg-card/30 border-border/30 flex-1" />
      </div>
      <Button size="sm" className="h-7 text-[11px]" disabled={!title.trim()} onClick={handleSubmit}>Create Pool</Button>
    </motion.div>
  );
}

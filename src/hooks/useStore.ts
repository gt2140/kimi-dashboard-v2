import { create } from "zustand";
import type { Agent, Message, VaultFile, AgentSettings, Prediction, TokenBalance, UserProfile, ActivityLog, ChatSession } from "@/types";
import { AGENTS, MOCK_VAULT_FILES } from "@/lib/data";

/* ─── Chat Store ─── */
interface ChatState {
  activeAgentId: string;
  calledAgentIds: string[];
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  sessions: ChatSession[];
  activeSessionId: string | null;
  setActiveAgent: (agentId: string) => void;
  callAgent: (agentId: string) => void;
  removeCalledAgent: (agentId: string) => void;
  clearCalledAgents: () => void;
  addMessage: (message: Message) => void;
  setStreaming: (isStreaming: boolean) => void;
  appendStreamingContent: (token: string) => void;
  finishStreaming: () => void;
  clearChat: () => void;
  saveSession: () => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
}

const generateSessionTitle = (msgs: Message[]): string => {
  const firstUser = msgs.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  return firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "..." : "");
};

const makeSessions = (): ChatSession[] => [
  {
    id: "session-1",
    agentId: "bloodwork",
    calledAgentIds: [],
    title: "Lipid panel interpretation",
    messages: [
      { id: "m1", role: "user", content: "Can you interpret my latest lipid panel? LDL is 118 and HDL 68.", agentId: "bloodwork", timestamp: new Date("2026-04-26T10:00:00") },
      { id: "m2", role: "assistant", content: "Your lipid panel shows excellent HDL at 68 mg/dL and borderline LDL at 118. The LDL-P (particle number) would help determine if this is Pattern A (large buoyant, lower risk) or Pattern B (small dense, higher risk). Your triglycerides at 78 suggest predominantly large buoyant LDL, which is favorable.", agentId: "bloodwork", timestamp: new Date("2026-04-26T10:01:00") },
    ],
    createdAt: new Date("2026-04-26T10:00:00"),
    updatedAt: new Date("2026-04-26T10:01:00"),
  },
  {
    id: "session-2",
    agentId: "nutrition",
    calledAgentIds: ["supplements"],
    title: "Keto diet + supplement stack",
    messages: [
      { id: "m3", role: "user", content: "I'm on keto and want to optimize my supplement stack for training days.", agentId: "nutrition", timestamp: new Date("2026-04-25T14:00:00") },
      { id: "m4", role: "assistant", content: "On a ketogenic diet with training, your key priorities are electrolytes, targeted carbs around workouts, and muscle preservation.\n\nPre-workout:\n- 20-30g carbs (fast-acting) 30min before\n- 5g creatine monohydrate\n- 3-5g sodium (bone broth or salt)", agentId: "nutrition", timestamp: new Date("2026-04-25T14:02:00"), metadata: { calledAgents: ["supplements"] } },
    ],
    createdAt: new Date("2026-04-25T14:00:00"),
    updatedAt: new Date("2026-04-25T14:02:00"),
  },
  {
    id: "session-3",
    agentId: "generalist",
    calledAgentIds: ["bloodwork", "nutrition"],
    title: "Full health review Q1 2026",
    messages: [
      { id: "m5", role: "user", content: "Please review all my Q1 data — bloodwork, body comp, and wearable trends.", agentId: "generalist", timestamp: new Date("2026-04-20T09:00:00") },
      { id: "m6", role: "assistant", content: "Comprehensive Q1 2026 review:\n\nBloodwork: All markers optimal except borderline LDL. hs-CRP 0.4 indicates very low inflammation.\n\nBody Composition: DEXA shows 14.2% body fat, 72.3kg lean mass. Visceral fat 89cm² (excellent).\n\nWearables: HRV trending up (62 to 70), sleep score averaging 86. RHR stable at 51 bpm.", agentId: "generalist", timestamp: new Date("2026-04-20T09:05:00"), metadata: { calledAgents: ["bloodwork", "nutrition"] } },
    ],
    createdAt: new Date("2026-04-20T09:00:00"),
    updatedAt: new Date("2026-04-20T09:05:00"),
  },
  {
    id: "session-4",
    agentId: "peptides",
    calledAgentIds: [],
    title: "BPC-157 for shoulder recovery",
    messages: [
      { id: "m7", role: "user", content: "Grade 1 rotator cuff strain. Is BPC-157 appropriate?", agentId: "peptides", timestamp: new Date("2026-04-18T16:00:00") },
      { id: "m8", role: "assistant", content: "BPC-157 is well-studied for tendon and ligament healing. For a grade 1 rotator cuff strain:\n\nProtocol:\n- 250-500mcg daily, subcutaneous near shoulder\n- 4-6 week cycle\n- Combine with TB-500 2mg 2x/week for synergistic effect\n\nMonitoring: Check hs-CRP and ESR at 2 and 4 weeks. Discontinue if no improvement by week 4.", agentId: "peptides", timestamp: new Date("2026-04-18T16:02:00") },
    ],
    createdAt: new Date("2026-04-18T16:00:00"),
    updatedAt: new Date("2026-04-18T16:02:00"),
  },
  {
    id: "session-5",
    agentId: "psychedelics",
    calledAgentIds: [],
    title: "Microdosing protocol setup",
    messages: [
      { id: "m9", role: "user", content: "I want to start a microdosing protocol for creativity and focus. Any risks with my current supplements?", agentId: "psychedelics", timestamp: new Date("2026-04-15T11:00:00") },
      { id: "m10", role: "assistant", content: "Safety first. Based on your stack (creatine, D3, omega-3, magnesium) — no direct contraindications with psilocybin microdosing.\n\nProtocol:\n- 50-100mg dried psilocybin mushrooms\n- Fadiman schedule: Day 1 dose, Day 2 off, Day 3 off, repeat\n- Track mood, focus, and sleep quality daily\n\nRed flags to stop: Increased anxiety, sleep disruption, or emotional blunting. Integrate with journaling.", agentId: "psychedelics", timestamp: new Date("2026-04-15T11:03:00") },
    ],
    createdAt: new Date("2026-04-15T11:00:00"),
    updatedAt: new Date("2026-04-15T11:03:00"),
  },
];

export const useChatStore = create<ChatState>((set, get) => ({
  activeAgentId: "generalist",
  calledAgentIds: [],
  messages: [],
  isStreaming: false,
  streamingContent: "",
  sessions: makeSessions(),
  activeSessionId: null,
  setActiveAgent: (agentId) =>
    set({ activeAgentId: agentId, messages: [], isStreaming: false, streamingContent: "", calledAgentIds: [], activeSessionId: null }),
  callAgent: (agentId) =>
    set((state) => ({
      calledAgentIds: state.calledAgentIds.includes(agentId)
        ? state.calledAgentIds
        : [...state.calledAgentIds, agentId],
    })),
  removeCalledAgent: (agentId) =>
    set((state) => ({
      calledAgentIds: state.calledAgentIds.filter((id) => id !== agentId),
    })),
  clearCalledAgents: () => set({ calledAgentIds: [] }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setStreaming: (isStreaming) => set({ isStreaming, streamingContent: "" }),
  appendStreamingContent: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),
  finishStreaming: () =>
    set((state) => {
      if (!state.streamingContent) return state;
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: state.streamingContent,
        agentId: state.activeAgentId,
        timestamp: new Date(),
        metadata: { calledAgents: state.calledAgentIds },
      };
      return {
        messages: [...state.messages, newMessage],
        isStreaming: false,
        streamingContent: "",
      };
    }),
  clearChat: () => {
    const state = get();
    if (state.messages.length > 0 && state.activeSessionId) {
      set((s) => ({
        sessions: s.sessions.map((sess) =>
          sess.id === s.activeSessionId
            ? { ...sess, messages: [...s.messages], updatedAt: new Date(), title: generateSessionTitle(s.messages) }
            : sess
        ),
        messages: [],
        isStreaming: false,
        streamingContent: "",
        activeSessionId: null,
      }));
    } else {
      set({ messages: [], isStreaming: false, streamingContent: "", activeSessionId: null });
    }
  },
  saveSession: () => {
    const state = get();
    if (state.messages.length === 0) return;
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      agentId: state.activeAgentId,
      calledAgentIds: state.calledAgentIds,
      title: generateSessionTitle(state.messages),
      messages: [...state.messages],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    set((s) => ({
      sessions: [newSession, ...s.sessions],
      activeSessionId: newSession.id,
    }));
  },
  loadSession: (sessionId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    set({
      activeSessionId: sessionId,
      activeAgentId: session.agentId,
      calledAgentIds: session.calledAgentIds,
      messages: [...session.messages],
      isStreaming: false,
      streamingContent: "",
    });
  },
  deleteSession: (sessionId) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    })),
}));

export function getActiveAgent(): Agent {
  const store = useChatStore.getState();
  return AGENTS.find((a) => a.id === store.activeAgentId) || AGENTS[0];
}

/* ─── Vault Store ─── */
interface VaultState {
  files: VaultFile[];
  activeCategory: string | null;
  addFile: (file: VaultFile) => void;
  removeFile: (fileId: string) => void;
  setActiveCategory: (cat: string | null) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  files: MOCK_VAULT_FILES,
  activeCategory: null,
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  removeFile: (fileId) =>
    set((state) => ({ files: state.files.filter((f) => f.id !== fileId) })),
  setActiveCategory: (cat) => set({ activeCategory: cat }),
}));

/* ─── Agent Settings Store ─── */
const DEFAULT_SETTINGS: Record<string, AgentSettings> = {};
AGENTS.forEach((a) => {
  DEFAULT_SETTINGS[a.id] = {
    agentId: a.id,
    vaultAccess: [...a.allowedVaultCategories],
    canSearchWeb: true,
    customContext: "",
    responseStyle: "detailed",
    autoSuggest: true,
    enabled: true,
  };
});

interface AgentSettingsState {
  settings: Record<string, AgentSettings>;
  updateSettings: (agentId: string, partial: Partial<AgentSettings>) => void;
}

export const useAgentSettingsStore = create<AgentSettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  updateSettings: (agentId, partial) =>
    set((state) => ({
      settings: {
        ...state.settings,
        [agentId]: { ...state.settings[agentId], ...partial },
      },
    })),
}));

/* ─── Predictions Store ─── */
interface PredictionsState {
  predictions: Prediction[];
  createPrediction: (p: Prediction) => void;
  respondToPrediction: (predictionId: string, response: Prediction["responses"][0]) => void;
  voteResponse: (predictionId: string, responseId: string) => void;
  resolvePrediction: (predictionId: string, bestResponseId: string) => void;
}

export const usePredictionsStore = create<PredictionsState>((set) => ({
  predictions: [
    {
      id: "pred-1",
      title: "Optimize my longevity protocol",
      description: "I want the most comprehensive longevity protocol based on my biomarkers. I have low-grade inflammation (hs-CRP 0.8) and suboptimal vitamin D (28 ng/mL).",
      objective: "Design a 90-day longevity protocol with specific supplements, peptides, and lifestyle interventions.",
      validationCriteria: "Must include dosing, timing, contraindication checks against my current stack, and expected biomarker improvements at 30, 60, and 90 days.",
      rewardTokens: 250,
      status: "open",
      createdBy: "Alex",
      createdAt: new Date("2026-04-20"),
      deadline: new Date("2026-05-20"),
      category: "Longevity",
      responses: [
        {
          id: "resp-1",
          predictionId: "pred-1",
          responderId: "miner-1",
          responderName: "BioHacker_01",
          content: "Protocol: Start with 5000IU D3 + K2 daily, add 500mg TMG for methylation support, BPC-157 250mcg for inflammation, and NR 500mg for NAD+ support. Expected 30d: D3 >40, hs-CRP <0.5.",
          confidence: 0.92,
          votes: 4,
          createdAt: new Date("2026-04-22"),
          status: "pending",
        },
        {
          id: "resp-2",
          predictionId: "pred-1",
          responderId: "miner-2",
          responderName: "DrPeptide",
          content: "Add EPA/DHA 2g daily for inflammation, consider rapamycin 3mg weekly (prescription required), sauna 4x/week for heat shock proteins, and fasting mimicking diet 5 days/month.",
          confidence: 0.88,
          votes: 2,
          createdAt: new Date("2026-04-23"),
          status: "pending",
        },
      ],
    },
    {
      id: "pred-2",
      title: "Interpret my thyroid panel pattern",
      description: "TSH 3.8, Free T3 2.8 (low-normal), Free T4 1.1, reverse T3 elevated. Feeling fatigued despite normal sleep.",
      objective: "Determine if this is subclinical hypothyroidism, T3 conversion issue, or something else. Need actionable next steps.",
      validationCriteria: "Must reference optimal ranges (not just standard), suggest further testing, and provide intervention options ranked by evidence level.",
      rewardTokens: 150,
      status: "open",
      createdBy: "Alex",
      createdAt: new Date("2026-04-25"),
      deadline: new Date("2026-05-10"),
      category: "Bloodwork",
      responses: [
        {
          id: "resp-3",
          predictionId: "pred-2",
          responderId: "miner-3",
          responderName: "EndoMiner",
          content: "Pattern suggests T4-T3 conversion issue (high rT3). Check ferritin, zinc, selenium. Consider low-dose T3 (liothyronine) 5mcg twice daily. Rule out adrenal dysfunction with DHEA-S and cortisol rhythm.",
          confidence: 0.95,
          votes: 7,
          createdAt: new Date("2026-04-26"),
          status: "pending",
        },
      ],
    },
    {
      id: "pred-3",
      title: "Best peptide stack for injury recovery",
      description: "Grade 2 rotator cuff tear, 6 weeks post-PT. Want to accelerate healing.",
      objective: "Design a peptide protocol specifically for tendon/ligament healing with dosing, timing, and monitoring labs.",
      validationCriteria: "Must include BPC-157 and TB-500 dosing protocols, injection sites, cycle length, and required bloodwork at 4 and 8 weeks.",
      rewardTokens: 300,
      status: "in-progress",
      createdBy: "Alex",
      createdAt: new Date("2026-04-10"),
      deadline: new Date("2026-04-30"),
      category: "Peptides",
      responses: [],
    },
  ],
  createPrediction: (p) =>
    set((state) => ({ predictions: [p, ...state.predictions] })),
  respondToPrediction: (predictionId, response) =>
    set((state) => ({
      predictions: state.predictions.map((pred) =>
        pred.id === predictionId
          ? { ...pred, responses: [...pred.responses, response] }
          : pred
      ),
    })),
  voteResponse: (predictionId, responseId) =>
    set((state) => ({
      predictions: state.predictions.map((pred) =>
        pred.id === predictionId
          ? {
              ...pred,
              responses: pred.responses.map((r) =>
                r.id === responseId ? { ...r, votes: r.votes + 1 } : r
              ),
            }
          : pred
      ),
    })),
  resolvePrediction: (predictionId, bestResponseId) =>
    set((state) => ({
      predictions: state.predictions.map((pred) =>
        pred.id === predictionId
          ? { ...pred, status: "resolved" as const, bestResponseId }
          : pred
      ),
    })),
}));

/* ─── Profile & Tokens Store ─── */
interface ProfileState {
  profile: UserProfile;
  balance: TokenBalance;
  logs: ActivityLog[];
  updateProfile: (partial: Partial<UserProfile>) => void;
  addTokens: (amount: number) => void;
  spendTokens: (amount: number) => void;
  stakeTokens: (amount: number) => void;
  addLog: (log: ActivityLog) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: {
    name: "Alex Mercer",
    email: "alex@example.com",
    bio: "Optimizing health through data. Tracking bloodwork, body composition, and wearable metrics since 2024.",
    joinedAt: new Date("2025-03-15"),
    healthGoals: ["Longevity", "Muscle preservation", "Cognitive optimization", "Sleep quality"],
    connectedDevices: ["Oura Ring", "Continuous Glucose Monitor", "Apple Watch"],
  },
  balance: {
    aura: 2450,
    staked: 800,
    earned: 1200,
    spent: 350,
  },
  logs: [
    { id: "log-1", type: "chat", description: "Consulted Bloodwork agent about lipid panel", timestamp: new Date("2026-04-27T10:30:00") },
    { id: "log-2", type: "prediction-created", description: "Created prediction: Optimize longevity protocol", tokens: -250, timestamp: new Date("2026-04-20T14:00:00") },
    { id: "log-3", type: "prediction-won", description: "Won prediction: Best sleep optimization stack", tokens: 180, timestamp: new Date("2026-04-18T09:15:00") },
    { id: "log-4", type: "vault-upload", description: "Uploaded bloodwork-q1-2026.pdf", timestamp: new Date("2026-04-15T11:20:00") },
    { id: "log-5", type: "token-earned", description: "Daily login reward", tokens: 10, timestamp: new Date("2026-04-27T08:00:00") },
    { id: "log-6", type: "prediction-responded", description: "Responded to: Thyroid panel interpretation", tokens: 15, timestamp: new Date("2026-04-26T16:45:00") },
  ],
  updateProfile: (partial) =>
    set((state) => ({ profile: { ...state.profile, ...partial } })),
  addTokens: (amount) =>
    set((state) => ({
      balance: { ...state.balance, aura: state.balance.aura + amount, earned: state.balance.earned + amount },
    })),
  spendTokens: (amount) =>
    set((state) => ({
      balance: { ...state.balance, aura: state.balance.aura - amount, spent: state.balance.spent + amount },
    })),
  stakeTokens: (amount) =>
    set((state) => ({
      balance: { ...state.balance, aura: state.balance.aura - amount, staked: state.balance.staked + amount },
    })),
  addLog: (log) =>
    set((state) => ({ logs: [log, ...state.logs] })),
}));

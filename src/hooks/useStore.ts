import { create } from "zustand";
import type {
  ActivityLog,
  Agent,
  AgentSettings,
  Prediction,
  TokenBalance,
  UserProfile,
} from "@/types";
import { AGENTS } from "@/lib/data";

type ChatSnapshot = {
  activeAgentId: string;
  calledAgentIds: string[];
  activeSessionId: string | null;
};

const defaultChatSnapshot: ChatSnapshot = {
  activeAgentId: "generalist",
  calledAgentIds: [],
  activeSessionId: null,
};

interface ChatState extends ChatSnapshot {
  setActiveAgent: (agentId: string) => void;
  callAgent: (agentId: string) => void;
  removeCalledAgent: (agentId: string) => void;
  clearCalledAgents: () => void;
  clearChat: () => void;
  hydrateConversation: (params: {
    sessionId: number;
    agentId: string;
    calledAgentIds: string[];
  }) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>(set => ({
  ...defaultChatSnapshot,
  setActiveAgent: agentId =>
    set({
      activeAgentId: agentId,
      calledAgentIds: [],
      activeSessionId: null,
    }),
  callAgent: agentId =>
    set(state => ({
      calledAgentIds: state.calledAgentIds.includes(agentId)
        ? state.calledAgentIds
        : [...state.calledAgentIds, agentId],
    })),
  removeCalledAgent: agentId =>
    set(state => ({
      calledAgentIds: state.calledAgentIds.filter(id => id !== agentId),
    })),
  clearCalledAgents: () => set({ calledAgentIds: [] }),
  clearChat: () =>
    set(state => ({
      activeAgentId: state.activeAgentId,
      calledAgentIds: [],
      activeSessionId: null,
    })),
  hydrateConversation: ({ sessionId, agentId, calledAgentIds }) =>
    set({
      activeSessionId: String(sessionId),
      activeAgentId: agentId,
      calledAgentIds,
    }),
  reset: () => set(defaultChatSnapshot),
}));

export function resetChatStore() {
  useChatStore.getState().reset();
}

export function getActiveAgent(): Agent {
  const store = useChatStore.getState();
  return AGENTS.find(agent => agent.id === store.activeAgentId) || AGENTS[0];
}

const DEFAULT_SETTINGS: Record<string, AgentSettings> = {};
for (const agent of AGENTS) {
  DEFAULT_SETTINGS[agent.id] = {
    agentId: agent.id,
    vaultAccess: [...agent.allowedVaultCategories],
    canSearchWeb: true,
    customContext: "",
    responseStyle: "detailed",
    autoSuggest: true,
    enabled: true,
  };
}

interface AgentSettingsState {
  settings: Record<string, AgentSettings>;
  updateSettings: (agentId: string, partial: Partial<AgentSettings>) => void;
}

export const useAgentSettingsStore = create<AgentSettingsState>(set => ({
  settings: DEFAULT_SETTINGS,
  updateSettings: (agentId, partial) =>
    set(state => ({
      settings: {
        ...state.settings,
        [agentId]: { ...state.settings[agentId], ...partial },
      },
    })),
}));

interface PredictionsState {
  predictions: Prediction[];
  createPrediction: (prediction: Prediction) => void;
  respondToPrediction: (
    predictionId: string,
    response: Prediction["responses"][0]
  ) => void;
  voteResponse: (predictionId: string, responseId: string) => void;
  resolvePrediction: (predictionId: string, bestResponseId: string) => void;
}

export const usePredictionsStore = create<PredictionsState>(set => ({
  predictions: [
    {
      id: "pred-1",
      title: "Optimize my longevity protocol",
      description:
        "I want the most comprehensive longevity protocol based on my biomarkers. I have low-grade inflammation (hs-CRP 0.8) and suboptimal vitamin D (28 ng/mL).",
      objective:
        "Design a 90-day longevity protocol with specific supplements, peptides, and lifestyle interventions.",
      validationCriteria:
        "Must include dosing, timing, contraindication checks against my current stack, and expected biomarker improvements at 30, 60, and 90 days.",
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
          content:
            "Protocol: Start with 5000IU D3 + K2 daily, add 500mg TMG for methylation support, BPC-157 250mcg for inflammation, and NR 500mg for NAD+ support. Expected 30d: D3 >40, hs-CRP <0.5.",
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
          content:
            "Add EPA/DHA 2g daily for inflammation, consider rapamycin 3mg weekly (prescription required), sauna 4x/week for heat shock proteins, and fasting mimicking diet 5 days/month.",
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
      description:
        "TSH 3.8, Free T3 2.8 (low-normal), Free T4 1.1, reverse T3 elevated. Feeling fatigued despite normal sleep.",
      objective:
        "Determine if this is subclinical hypothyroidism, T3 conversion issue, or something else. Need actionable next steps.",
      validationCriteria:
        "Must reference optimal ranges (not just standard), suggest further testing, and provide intervention options ranked by evidence level.",
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
          content:
            "Pattern suggests T4-T3 conversion issue (high rT3). Check ferritin, zinc, selenium. Consider low-dose T3 (liothyronine) 5mcg twice daily. Rule out adrenal dysfunction with DHEA-S and cortisol rhythm.",
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
      description:
        "Grade 2 rotator cuff tear, 6 weeks post-PT. Want to accelerate healing.",
      objective:
        "Design a peptide protocol specifically for tendon/ligament healing with dosing, timing, and monitoring labs.",
      validationCriteria:
        "Must include BPC-157 and TB-500 dosing protocols, injection sites, cycle length, and required bloodwork at 4 and 8 weeks.",
      rewardTokens: 300,
      status: "in-progress",
      createdBy: "Alex",
      createdAt: new Date("2026-04-10"),
      deadline: new Date("2026-04-30"),
      category: "Peptides",
      responses: [],
    },
  ],
  createPrediction: prediction =>
    set(state => ({ predictions: [prediction, ...state.predictions] })),
  respondToPrediction: (predictionId, response) =>
    set(state => ({
      predictions: state.predictions.map(prediction =>
        prediction.id === predictionId
          ? { ...prediction, responses: [...prediction.responses, response] }
          : prediction
      ),
    })),
  voteResponse: (predictionId, responseId) =>
    set(state => ({
      predictions: state.predictions.map(prediction =>
        prediction.id === predictionId
          ? {
              ...prediction,
              responses: prediction.responses.map(response =>
                response.id === responseId
                  ? { ...response, votes: response.votes + 1 }
                  : response
              ),
            }
          : prediction
      ),
    })),
  resolvePrediction: (predictionId, bestResponseId) =>
    set(state => ({
      predictions: state.predictions.map(prediction =>
        prediction.id === predictionId
          ? { ...prediction, status: "resolved", bestResponseId }
          : prediction
      ),
    })),
}));

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

export const useProfileStore = create<ProfileState>(set => ({
  profile: {
    name: "Alex Mercer",
    email: "alex@example.com",
    bio: "Optimizing health through data. Tracking bloodwork, body composition, and wearable metrics since 2024.",
    joinedAt: new Date("2025-03-15"),
    healthGoals: [
      "Longevity",
      "Muscle preservation",
      "Cognitive optimization",
      "Sleep quality",
    ],
    connectedDevices: [
      "Oura Ring",
      "Continuous Glucose Monitor",
      "Apple Watch",
    ],
  },
  balance: {
    aura: 2450,
    staked: 800,
    earned: 1200,
    spent: 350,
  },
  logs: [
    {
      id: "log-1",
      type: "chat",
      description: "Consulted Bloodwork agent about lipid panel",
      timestamp: new Date("2026-04-27T10:30:00"),
    },
    {
      id: "log-2",
      type: "prediction-created",
      description: "Created prediction: Optimize longevity protocol",
      tokens: -250,
      timestamp: new Date("2026-04-20T14:00:00"),
    },
    {
      id: "log-3",
      type: "prediction-won",
      description: "Won prediction: Best sleep optimization stack",
      tokens: 180,
      timestamp: new Date("2026-04-18T09:15:00"),
    },
    {
      id: "log-4",
      type: "vault-upload",
      description: "Uploaded bloodwork-q1-2026.pdf",
      timestamp: new Date("2026-04-15T11:20:00"),
    },
    {
      id: "log-5",
      type: "token-earned",
      description: "Daily login reward",
      tokens: 10,
      timestamp: new Date("2026-04-27T08:00:00"),
    },
    {
      id: "log-6",
      type: "prediction-responded",
      description: "Responded to: Thyroid panel interpretation",
      tokens: 15,
      timestamp: new Date("2026-04-26T16:45:00"),
    },
  ],
  updateProfile: partial =>
    set(state => ({ profile: { ...state.profile, ...partial } })),
  addTokens: amount =>
    set(state => ({
      balance: {
        ...state.balance,
        aura: state.balance.aura + amount,
        earned: state.balance.earned + amount,
      },
    })),
  spendTokens: amount =>
    set(state => ({
      balance: {
        ...state.balance,
        aura: state.balance.aura - amount,
        spent: state.balance.spent + amount,
      },
    })),
  stakeTokens: amount =>
    set(state => ({
      balance: {
        ...state.balance,
        aura: state.balance.aura - amount,
        staked: state.balance.staked + amount,
      },
    })),
  addLog: log => set(state => ({ logs: [log, ...state.logs] })),
}));

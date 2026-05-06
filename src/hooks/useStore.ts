import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AuraMedicalMode,
  AuraPolicyLevel,
  AuraRuntimeVersion,
} from "@contracts/aura-runtime";
import type { Agent } from "@/types";
import { AGENTS } from "@/lib/data";

type ChatSnapshot = {
  activeAgentId: string;
  calledAgentIds: string[];
  activeSessionId: string | null;
  runtimeVersion: AuraRuntimeVersion;
  medicalMode: AuraMedicalMode;
  policyLevel: AuraPolicyLevel;
};

const defaultChatSnapshot: ChatSnapshot = {
  activeAgentId: "generalist",
  calledAgentIds: [],
  activeSessionId: null,
  runtimeVersion: "aura-medical-v1",
  medicalMode: "personal-health",
  policyLevel: "interpretive-on-request",
};

interface ChatState extends ChatSnapshot {
  setActiveAgent: (agentId: string) => void;
  setRuntimeVersion: (runtimeVersion: AuraRuntimeVersion) => void;
  setMedicalMode: (medicalMode: AuraMedicalMode) => void;
  setPolicyLevel: (policyLevel: AuraPolicyLevel) => void;
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
  setRuntimeVersion: runtimeVersion => set({ runtimeVersion }),
  setMedicalMode: medicalMode => set({ medicalMode }),
  setPolicyLevel: policyLevel => set({ policyLevel }),
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
      runtimeVersion: state.runtimeVersion,
      medicalMode: state.medicalMode,
      policyLevel: state.policyLevel,
    })),
  hydrateConversation: ({ sessionId, agentId, calledAgentIds }) =>
    set(state => ({
      activeSessionId: String(sessionId),
      activeAgentId: agentId,
      calledAgentIds,
      runtimeVersion: state.runtimeVersion,
      medicalMode: state.medicalMode,
      policyLevel: state.policyLevel,
    })),
  reset: () => set(defaultChatSnapshot),
}));

export function resetChatStore() {
  useChatStore.getState().reset();
}

export function getActiveAgent(): Agent {
  const store = useChatStore.getState();
  return AGENTS.find(agent => agent.id === store.activeAgentId) || AGENTS[0];
}

interface FavoriteAgentsState {
  favoriteAgentIds: string[];
  setFavoriteAgentIds: (agentIds: string[]) => void;
  toggleFavoriteAgent: (agentId: string) => void;
  isFavoriteAgent: (agentId: string) => boolean;
}

const DEFAULT_FAVORITE_AGENT_IDS = ["generalist"];

export const useFavoriteAgentsStore = create<FavoriteAgentsState>()(
  persist(
    (set, get) => ({
      favoriteAgentIds: DEFAULT_FAVORITE_AGENT_IDS,
      setFavoriteAgentIds: agentIds =>
        set({
          favoriteAgentIds: Array.from(
            new Set(["generalist", ...agentIds.filter(Boolean)])
          ),
        }),
      toggleFavoriteAgent: agentId =>
        set(state => {
          if (agentId === "generalist") {
            return state;
          }

          const exists = state.favoriteAgentIds.includes(agentId);
          return {
            favoriteAgentIds: exists
              ? state.favoriteAgentIds.filter(id => id !== agentId)
              : [...state.favoriteAgentIds, agentId],
          };
        }),
      isFavoriteAgent: agentId => get().favoriteAgentIds.includes(agentId),
    }),
    {
      name: "favorite-agents",
    }
  )
);

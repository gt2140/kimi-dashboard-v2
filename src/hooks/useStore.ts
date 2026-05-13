import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AuraMedicalMode,
  AuraPolicyLevel,
  AuraRuntimeVersion,
} from "@contracts/aura-runtime";
import type { Agent } from "@/types";
import { AGENTS } from "@/lib/data";
import type { ChatModelProviderSlug } from "@/lib/model-catalog";

type ChatSnapshot = {
  activeAgentId: string;
  calledAgentIds: string[];
  activeSessionId: string | null;
  runtimeVersion: AuraRuntimeVersion;
  medicalMode: AuraMedicalMode;
  policyLevel: AuraPolicyLevel;
  chatViewMode: "general" | "health" | "research";
  selectedProviderSlug: ChatModelProviderSlug;
  selectedModelName: string | null;
};

const defaultChatSnapshot: ChatSnapshot = {
  activeAgentId: "generalist",
  calledAgentIds: [],
  activeSessionId: null,
  runtimeVersion: "aura-medical-v1",
  medicalMode: "personal-health",
  policyLevel: "interpretive-on-request",
  chatViewMode: "general",
  selectedProviderSlug: "auto",
  selectedModelName: null,
};

interface ChatState extends ChatSnapshot {
  setActiveAgent: (agentId: string) => void;
  setRuntimeVersion: (runtimeVersion: AuraRuntimeVersion) => void;
  setMedicalMode: (medicalMode: AuraMedicalMode) => void;
  setPolicyLevel: (policyLevel: AuraPolicyLevel) => void;
  setChatViewMode: (chatViewMode: "general" | "health" | "research") => void;
  setSelectedModel: (selection: {
    providerSlug: ChatModelProviderSlug;
    modelName: string | null;
  }) => void;
  resetSelectedModel: () => void;
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

export const useChatStore = create<ChatState>()(
  persist(
    set => ({
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
      setChatViewMode: chatViewMode => set({ chatViewMode }),
      setSelectedModel: selection =>
        set({
          selectedProviderSlug: selection.providerSlug,
          selectedModelName:
            selection.providerSlug === "auto" ? null : selection.modelName,
        }),
      resetSelectedModel: () =>
        set({
          selectedProviderSlug: "auto",
          selectedModelName: null,
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
          runtimeVersion: state.runtimeVersion,
          medicalMode: state.medicalMode,
          policyLevel: state.policyLevel,
          chatViewMode: state.chatViewMode,
          selectedProviderSlug: state.selectedProviderSlug,
          selectedModelName: state.selectedModelName,
        })),
      hydrateConversation: ({ sessionId, agentId, calledAgentIds }) =>
        set(state => ({
          activeSessionId: String(sessionId),
          activeAgentId: agentId,
          calledAgentIds,
          runtimeVersion: state.runtimeVersion,
          medicalMode: state.medicalMode,
          policyLevel: state.policyLevel,
          chatViewMode: state.chatViewMode,
          selectedProviderSlug: state.selectedProviderSlug,
          selectedModelName: state.selectedModelName,
        })),
      reset: () => set(defaultChatSnapshot),
    }),
    {
      name: "chat-store",
      partialize: state => ({
        runtimeVersion: state.runtimeVersion,
        medicalMode: state.medicalMode,
        policyLevel: state.policyLevel,
        chatViewMode: state.chatViewMode,
        selectedProviderSlug: state.selectedProviderSlug,
        selectedModelName: state.selectedModelName,
      }),
    },
  ),
);

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

import { useMemo, useState } from "react";
import { useAgentSettingsStore, useFavoriteAgentsStore } from "@/hooks/useStore";
import { AGENTS } from "@/lib/data";

type AgentView = {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  icon: string;
  color: string;
  author: string;
  installs: number;
  rating: string | null;
  tags: string[];
  allowedVaultCategories: string[];
  source: string;
  systemPrompt: string;
};

type AgentSettingView = {
  userId: number;
  agentDefinitionId: number;
  isFavorite: boolean;
  isEnabled: boolean;
  customContext: string | null;
  trainingNotes: string | null;
  responseStyle: "concise" | "detailed" | "academic";
  preferredProviderId: number | null;
  preferredModelId: number | null;
  allowVaultContext: boolean;
  allowWebResearch: boolean;
  allowScientificResearch: boolean;
  kimiThinkingMode: "enabled" | "disabled";
  preferKimiMemory: boolean;
  enabledFormulaTools: string[];
  allowedContextOverrides: string[];
};

type ProviderView = {
  id: number;
  slug: string;
  name: string;
  endpoints: Array<{
    id: number;
    label: string;
  }>;
};

const LOCAL_PROVIDERS: ProviderView[] = [
  {
    id: 1,
    slug: "kimi",
    name: "Kimi",
    endpoints: [
      {
        id: 1,
        label: "kimi-k2.6",
      },
    ],
  },
];

function mapAgent(agent: (typeof AGENTS)[number]): AgentView {
  return {
    slug: agent.id,
    name: agent.name,
    description: agent.description,
    longDescription: agent.longDescription,
    icon: agent.icon,
    color: agent.color,
    author: agent.author ?? "Aura Marketplace",
    installs: agent.installs ?? 0,
    rating:
      typeof agent.rating === "number" ? agent.rating.toFixed(2) : null,
    tags: agent.tags ?? [],
    allowedVaultCategories: agent.allowedVaultCategories,
    source: agent.source ?? "built-in",
    systemPrompt: agent.systemPrompt,
  };
}

function normalizeSetting(
  agent: (typeof AGENTS)[number],
  setting: ReturnType<typeof useAgentSettingsStore.getState>["settings"][string] | undefined,
  isFavorite: boolean,
): AgentSettingView {
  return {
    userId: 0,
    agentDefinitionId: 0,
    isFavorite,
    isEnabled: setting?.enabled ?? true,
    customContext: setting?.customContext?.trim() || null,
    trainingNotes: setting?.trainingNotes?.trim() || null,
    responseStyle: setting?.responseStyle ?? "detailed",
    preferredProviderId: setting?.preferredProviderId ?? 1,
    preferredModelId: setting?.preferredModelId ?? 1,
    allowVaultContext: setting?.allowVaultContext ?? true,
    allowWebResearch: setting?.allowWebResearch ?? true,
    allowScientificResearch: setting?.allowScientificResearch ?? false,
    kimiThinkingMode: setting?.kimiThinkingMode ?? "disabled",
    preferKimiMemory: setting?.preferKimiMemory ?? false,
    enabledFormulaTools: setting?.enabledFormulaTools ?? [],
    allowedContextOverrides:
      setting?.allowedContextOverrides ?? agent.allowedVaultCategories,
  };
}

export function useAgentCatalog() {
  const [isSaving, setIsSaving] = useState(false);
  const settings = useAgentSettingsStore(state => state.settings);
  const updateSettings = useAgentSettingsStore(state => state.updateSettings);
  const favoriteAgentIds = useFavoriteAgentsStore(state => state.favoriteAgentIds);
  const setFavoriteAgentIds = useFavoriteAgentsStore(
    state => state.setFavoriteAgentIds,
  );

  const agents = useMemo(
    () => AGENTS.map(mapAgent),
    [],
  );

  const userSettings = useMemo(
    () =>
      AGENTS.map(agent => {
        const agentView = mapAgent(agent);
        const isFavorite = favoriteAgentIds.includes(agent.id);
        return {
          agent: agentView,
          ...normalizeSetting(agent, settings[agent.id], isFavorite),
        };
      }),
    [favoriteAgentIds, settings],
  );

  const favoriteAgents = useMemo(
    () =>
      favoriteAgentIds
        .map(agentId => agents.find(agent => agent.slug === agentId))
        .filter(
          (
            agent,
          ): agent is AgentView => Boolean(agent),
        ),
    [agents, favoriteAgentIds],
  );

  const settingsBySlug = useMemo(
    () =>
      new Map(
        userSettings.map(setting => [setting.agent.slug, setting]),
      ),
    [userSettings],
  );

  async function saveUserSettings(input: {
    slug: string;
    isFavorite?: boolean;
    isEnabled?: boolean;
    customContext?: string | null;
    trainingNotes?: string | null;
    responseStyle?: "concise" | "detailed" | "academic";
    preferredProviderId?: number | null;
    preferredModelId?: number | null;
    allowVaultContext?: boolean;
    allowWebResearch?: boolean;
    allowScientificResearch?: boolean;
    kimiThinkingMode?: "enabled" | "disabled";
    preferKimiMemory?: boolean;
    enabledFormulaTools?: string[];
    allowedContextOverrides?: string[];
  }) {
    const agent = AGENTS.find(candidate => candidate.id === input.slug);
    if (!agent) {
      throw new Error("Agent not found.");
    }

    setIsSaving(true);

    try {
      const resolvedIsFavorite =
        input.isFavorite ?? favoriteAgentIds.includes(input.slug);

      if (typeof input.isFavorite === "boolean") {
        const nextFavorites = input.isFavorite
          ? Array.from(new Set([...favoriteAgentIds, input.slug]))
          : favoriteAgentIds.filter(id => id !== input.slug);
        setFavoriteAgentIds(nextFavorites);
      }

      updateSettings(input.slug, {
        enabled: input.isEnabled ?? settings[input.slug]?.enabled ?? true,
        customContext: input.customContext ?? settings[input.slug]?.customContext ?? "",
        trainingNotes: input.trainingNotes ?? settings[input.slug]?.trainingNotes ?? "",
        responseStyle:
          input.responseStyle ?? settings[input.slug]?.responseStyle ?? "detailed",
        preferredProviderId:
          input.preferredProviderId ?? settings[input.slug]?.preferredProviderId ?? 1,
        preferredModelId:
          input.preferredModelId ?? settings[input.slug]?.preferredModelId ?? 1,
        allowVaultContext:
          input.allowVaultContext ?? settings[input.slug]?.allowVaultContext ?? true,
        allowWebResearch:
          input.allowWebResearch ?? settings[input.slug]?.allowWebResearch ?? true,
        allowScientificResearch:
          input.allowScientificResearch ??
          settings[input.slug]?.allowScientificResearch ??
          false,
        kimiThinkingMode:
          input.kimiThinkingMode ?? settings[input.slug]?.kimiThinkingMode ?? "disabled",
        preferKimiMemory:
          input.preferKimiMemory ?? settings[input.slug]?.preferKimiMemory ?? false,
        enabledFormulaTools:
          input.enabledFormulaTools ?? settings[input.slug]?.enabledFormulaTools ?? [],
        allowedContextOverrides:
          input.allowedContextOverrides ??
          settings[input.slug]?.allowedContextOverrides ??
          agent.allowedVaultCategories,
        isFavorite: resolvedIsFavorite,
      });

      return {
        agent: mapAgent(agent),
        setting: normalizeSetting(
          agent,
          {
            ...settings[input.slug],
            ...useAgentSettingsStore.getState().settings[input.slug],
          },
          resolvedIsFavorite,
        ),
      };
    } finally {
      setIsSaving(false);
    }
  }

  function getUserSettings(slug: string) {
    return settingsBySlug.get(slug) ?? null;
  }

  return {
    agents,
    favoriteAgents,
    favoriteAgentIds,
    userSettings,
    providers: LOCAL_PROVIDERS,
    getUserSettings,
    isLoading: false,
    isSaving,
    error: null,
    saveUserSettings,
  };
}

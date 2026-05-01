import { useEffect, useMemo } from "react";
import {
  trpc,
  ensureBackendSession,
  useBackendSessionState,
} from "@/providers/trpc";
import { useFavoriteAgentsStore } from "@/hooks/useStore";
import { formatRuntimeError } from "@/lib/app-errors";
import { AGENTS } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase";

function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { data?: { code?: string }; message?: string };
  return (
    candidate.data?.code === "UNAUTHORIZED" ||
    candidate.message?.toLowerCase().includes("unauth") === true
  );
}

export function useAgentCatalog() {
  const utils = trpc.useUtils();
  const backendSession = useBackendSessionState();
  const localFavoriteAgentIds = useFavoriteAgentsStore(
    state => state.favoriteAgentIds
  );
  const setFavoriteAgentIds = useFavoriteAgentsStore(
    state => state.setFavoriteAgentIds
  );

  const agentsQuery = trpc.agents.list.useQuery();
  const userSettingsEnabled =
    !isSupabaseConfigured || backendSession.backendReady;
  const userSettingsQuery = trpc.agents.listUserSettings.useQuery(undefined, {
    enabled: userSettingsEnabled,
    retry: false,
  });
  const saveUserSettingsMutation = trpc.agents.saveUserSettings.useMutation();

  useEffect(() => {
    if (!userSettingsQuery.data) {
      return;
    }

    const backendFavorites = [
      "generalist",
      ...userSettingsQuery.data
        .filter(item => item.isFavorite)
        .map(item => item.agent.slug),
    ];

    setFavoriteAgentIds(backendFavorites);
  }, [setFavoriteAgentIds, userSettingsQuery.data]);

  const favoriteAgentIds = useMemo(() => {
    if (!userSettingsQuery.data) {
      return localFavoriteAgentIds;
    }

    return Array.from(
      new Set([
        "generalist",
        ...userSettingsQuery.data
          .filter(item => item.isFavorite)
          .map(item => item.agent.slug),
      ])
    );
  }, [localFavoriteAgentIds, userSettingsQuery.data]);

  const agents = useMemo(() => {
    if (agentsQuery.data?.length) {
      return agentsQuery.data;
    }

    return AGENTS.map(agent => ({
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
      source: "marketplace",
    }));
  }, [agentsQuery.data]);

  const favoriteAgents = useMemo(
    () =>
      favoriteAgentIds
        .map(agentId => agents.find(agent => agent.slug === agentId))
        .filter(
          (
            agent
          ): agent is (typeof agents)[number] =>
            Boolean(agent)
        ),
    [agents, favoriteAgentIds]
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
    const synced = await ensureBackendSession();
    if (!synced) {
      throw new Error(
        "Your browser session exists, but the backend session is not ready yet."
      );
    }

    try {
      const result = await saveUserSettingsMutation.mutateAsync(input);
      await Promise.all([
        utils.agents.list.invalidate(),
        utils.agents.listUserSettings.invalidate(),
        utils.agents.getUserSettings.invalidate({ slug: input.slug }),
        utils.chat.invalidate(),
      ]);
      return result;
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        throw error;
      }

      const retrySynced = await ensureBackendSession({ force: true });
      if (!retrySynced) {
        throw error;
      }

      const result = await saveUserSettingsMutation.mutateAsync(input);
      await Promise.all([
        utils.agents.list.invalidate(),
        utils.agents.listUserSettings.invalidate(),
        utils.agents.getUserSettings.invalidate({ slug: input.slug }),
        utils.chat.invalidate(),
      ]);
      return result;
    }
  }

  const error =
    agentsQuery.error ??
    userSettingsQuery.error ??
    saveUserSettingsMutation.error ??
    null;

  return {
    agents,
    favoriteAgents,
    favoriteAgentIds,
    userSettings: userSettingsQuery.data ?? [],
    isLoading: agentsQuery.isLoading || userSettingsQuery.isLoading,
    isSaving: saveUserSettingsMutation.isPending,
    error: error ? formatRuntimeError(error, "Agents") : null,
    saveUserSettings,
  };
}

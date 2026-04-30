type OverviewAgent = {
  slug: string;
  name: string;
};

export function getMobileOverviewAgents<T extends OverviewAgent>(
  agents: T[],
  favoriteAgentIds: string[],
  limit = 3
) {
  const bySlug = new Map(agents.map((agent) => [agent.slug, agent] as const));
  const orderedIds = Array.from(
    new Set(["generalist", ...favoriteAgentIds.filter(Boolean)])
  );

  return orderedIds
    .map((slug) => bySlug.get(slug))
    .filter((agent): agent is T => Boolean(agent))
    .slice(0, limit);
}

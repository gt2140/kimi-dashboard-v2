import { and, eq, inArray } from "drizzle-orm";
import { agentDefinitions, conversationAgents } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";
import { ensureConversationalCatalogSeeded } from "../queries/agents.js";

export async function syncConversationParticipants(params: {
  conversationId: number;
  primaryAgentSlug: string;
  supportingAgentSlugs: string[];
}) {
  await ensureConversationalCatalogSeeded();
  const db = getDb();
  const slugs = [params.primaryAgentSlug, ...params.supportingAgentSlugs];
  const definitions = await db
    .select()
    .from(agentDefinitions)
    .where(inArray(agentDefinitions.slug, slugs));

  const bySlug = new Map(
    definitions.map(definition => [definition.slug, definition] as const)
  );

  const primary = bySlug.get(params.primaryAgentSlug);
  if (!primary) {
    throw new Error(`Primary agent ${params.primaryAgentSlug} was not found`);
  }

  const activeSupportingIds = params.supportingAgentSlugs
    .map(slug => bySlug.get(slug)?.id)
    .filter((value): value is number => Boolean(value));

  await db
    .insert(conversationAgents)
    .values({
      conversationId: params.conversationId,
      agentDefinitionId: primary.id,
      role: "primary",
      addedByUser: true,
      position: 0,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [
        conversationAgents.conversationId,
        conversationAgents.agentDefinitionId,
        conversationAgents.role,
      ],
      set: {
        addedByUser: true,
        position: 0,
        isActive: true,
      },
    });

  await db
    .update(conversationAgents)
    .set({ isActive: false })
    .where(
      and(
        eq(conversationAgents.conversationId, params.conversationId),
        eq(conversationAgents.role, "supporting")
      )
    );

  for (const [index, slug] of params.supportingAgentSlugs.entries()) {
    const supporting = bySlug.get(slug);
    if (!supporting) {
      continue;
    }

    await db
      .insert(conversationAgents)
      .values({
        conversationId: params.conversationId,
        agentDefinitionId: supporting.id,
        role: "supporting",
        addedByUser: true,
        position: index + 1,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [
          conversationAgents.conversationId,
          conversationAgents.agentDefinitionId,
          conversationAgents.role,
        ],
        set: {
          addedByUser: true,
          position: index + 1,
          isActive: true,
        },
      });
  }

  if (activeSupportingIds.length > 0) {
    await db
      .update(conversationAgents)
      .set({ isActive: true })
      .where(
        and(
          eq(conversationAgents.conversationId, params.conversationId),
          eq(conversationAgents.role, "supporting"),
          inArray(conversationAgents.agentDefinitionId, activeSupportingIds)
        )
      );
  }

  return {
    primary,
    supporting: params.supportingAgentSlugs
      .map(slug => bySlug.get(slug))
      .filter(Boolean),
  };
}

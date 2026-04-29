import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import {
  ensureConversationalCatalogSeeded,
  getActiveSystemPrompt,
  getAgentDefinitionBySlug,
  getUserAgentSetting,
  listAgentDefinitions,
  listModelProvidersWithEndpoints,
  listUserAgentSettings,
} from "./queries/agents";
import { getDb } from "./queries/connection";
import { agentDefinitions, userAgentSettings } from "@db/schema";

const userAgentSettingsInput = z.object({
  slug: z.string().min(1),
  isFavorite: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  customContext: z.string().nullable().optional(),
  trainingNotes: z.string().nullable().optional(),
  responseStyle: z.enum(["concise", "detailed", "academic"]).optional(),
  preferredProviderId: z.number().int().nullable().optional(),
  preferredModelId: z.number().int().nullable().optional(),
  allowVaultContext: z.boolean().optional(),
  allowWebResearch: z.boolean().optional(),
  allowScientificResearch: z.boolean().optional(),
  allowedContextOverrides: z.array(z.string()).optional(),
});

export const agentsRouter = createRouter({
  list: publicQuery.query(async () => {
    return listAgentDefinitions();
  }),

  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const agent = await getAgentDefinitionBySlug(input.id);
      if (!agent) {
        throw new Error("Agent not found");
      }
      const systemPrompt = await getActiveSystemPrompt(agent.id);
      return {
        ...agent,
        systemPrompt: systemPrompt?.templateText ?? null,
      };
    }),

  listProviders: publicQuery.query(async () => {
    return listModelProvidersWithEndpoints();
  }),

  listUserSettings: authedQuery.query(async ({ ctx }) => {
    return listUserAgentSettings(ctx.user.id);
  }),

  getUserSettings: authedQuery
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      await ensureConversationalCatalogSeeded();
      const agent = await getAgentDefinitionBySlug(input.slug);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const existing = await getUserAgentSetting(ctx.user.id, agent.id);
      const systemPrompt = await getActiveSystemPrompt(agent.id);
      return {
        agent: {
          ...agent,
          systemPrompt: systemPrompt?.templateText ?? null,
        },
        setting:
          existing ??
          ({
            userId: ctx.user.id,
            agentDefinitionId: agent.id,
            isFavorite: agent.slug === "generalist",
            isEnabled: true,
            customContext: null,
            trainingNotes: null,
            responseStyle: "detailed",
            preferredProviderId: null,
            preferredModelId: null,
            allowVaultContext: true,
            allowWebResearch: true,
            allowScientificResearch: false,
            allowedContextOverrides: [],
          } as const),
      };
    }),

  saveUserSettings: authedQuery
    .input(userAgentSettingsInput)
    .mutation(async ({ input, ctx }) => {
      await ensureConversationalCatalogSeeded();
      const agent = await getAgentDefinitionBySlug(input.slug);
      if (!agent) {
        throw new Error("Agent not found");
      }

      const db = getDb();
      const existing = await db
        .select()
        .from(userAgentSettings)
        .where(
          and(
            eq(userAgentSettings.userId, ctx.user.id),
            eq(userAgentSettings.agentDefinitionId, agent.id)
          )
        )
        .limit(1);

      const nextValues = {
        userId: ctx.user.id,
        agentDefinitionId: agent.id,
        isFavorite:
          agent.slug === "generalist"
            ? true
            : (input.isFavorite ?? (existing[0]?.isFavorite ?? false)),
        isEnabled: input.isEnabled ?? (existing[0]?.isEnabled ?? true),
        customContext:
          input.customContext !== undefined
            ? input.customContext
            : (existing[0]?.customContext ?? null),
        trainingNotes:
          input.trainingNotes !== undefined
            ? input.trainingNotes
            : (existing[0]?.trainingNotes ?? null),
        responseStyle:
          input.responseStyle ?? existing[0]?.responseStyle ?? "detailed",
        preferredProviderId:
          input.preferredProviderId !== undefined
            ? input.preferredProviderId
            : (existing[0]?.preferredProviderId ?? null),
        preferredModelId:
          input.preferredModelId !== undefined
            ? input.preferredModelId
            : (existing[0]?.preferredModelId ?? null),
        allowVaultContext:
          input.allowVaultContext ?? (existing[0]?.allowVaultContext ?? true),
        allowWebResearch:
          input.allowWebResearch ?? (existing[0]?.allowWebResearch ?? true),
        allowScientificResearch:
          input.allowScientificResearch ??
          (existing[0]?.allowScientificResearch ?? false),
        allowedContextOverrides:
          input.allowedContextOverrides ??
          existing[0]?.allowedContextOverrides ??
          [],
        updatedAt: new Date(),
      };

      await db
        .insert(userAgentSettings)
        .values(nextValues)
        .onConflictDoUpdate({
          target: [userAgentSettings.userId, userAgentSettings.agentDefinitionId],
          set: {
            isFavorite: nextValues.isFavorite,
            isEnabled: nextValues.isEnabled,
            customContext: nextValues.customContext,
            trainingNotes: nextValues.trainingNotes,
            responseStyle: nextValues.responseStyle,
            preferredProviderId: nextValues.preferredProviderId,
            preferredModelId: nextValues.preferredModelId,
            allowVaultContext: nextValues.allowVaultContext,
            allowWebResearch: nextValues.allowWebResearch,
            allowScientificResearch: nextValues.allowScientificResearch,
            allowedContextOverrides: nextValues.allowedContextOverrides,
            updatedAt: nextValues.updatedAt,
          },
        });

      const setting = await getUserAgentSetting(ctx.user.id, agent.id);
      return {
        agent,
        setting,
      };
    }),

  bootstrapCatalog: publicQuery.mutation(async () => {
    await ensureConversationalCatalogSeeded();
    const count = (await getDb().select().from(agentDefinitions)).length;
    return { ok: true, count };
  }),
});

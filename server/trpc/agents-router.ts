import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createRouter, authedQuery, publicQuery } from "./middleware.js";
import {
  ensureConversationalCatalogSeeded,
  getActiveSystemPrompt,
  getAgentDefinitionBySlug,
  getUserAgentSetting,
  listAgentDefinitions,
  listUserAgentSettings,
} from "../queries/agents.js";
import { getDb } from "../queries/connection.js";
import { agentDefinitions, userAgentSettings } from "../../db/schema.js";

const userAgentSettingsInput = z.object({
  slug: z.string().min(1),
  isFavorite: z.boolean().optional(),
  customContext: z.string().nullable().optional(),
  responseStyle: z.enum(["concise", "detailed", "academic"]).optional(),
  allowVaultContext: z.boolean().optional(),
  allowWebResearch: z.boolean().optional(),
  kimiThinkingMode: z.enum(["enabled", "disabled"]).optional(),
  preferKimiMemory: z.boolean().optional(),
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
            customContext: null,
            responseStyle: "detailed",
            allowVaultContext: true,
            allowWebResearch: true,
            kimiThinkingMode: "enabled",
            preferKimiMemory: true,
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
        customContext:
          input.customContext !== undefined
            ? input.customContext
            : (existing[0]?.customContext ?? null),
        responseStyle:
          input.responseStyle ?? existing[0]?.responseStyle ?? "detailed",
        allowVaultContext:
          input.allowVaultContext ?? (existing[0]?.allowVaultContext ?? true),
        allowWebResearch:
          input.allowWebResearch ?? (existing[0]?.allowWebResearch ?? true),
        kimiThinkingMode:
          input.kimiThinkingMode ?? existing[0]?.kimiThinkingMode ?? "enabled",
        preferKimiMemory:
          input.preferKimiMemory ?? (existing[0]?.preferKimiMemory ?? true),
        updatedAt: new Date(),
      };

      await db
        .insert(userAgentSettings)
        .values(nextValues)
        .onConflictDoUpdate({
          target: [userAgentSettings.userId, userAgentSettings.agentDefinitionId],
          set: {
            isFavorite: nextValues.isFavorite,
            customContext: nextValues.customContext,
            responseStyle: nextValues.responseStyle,
            allowVaultContext: nextValues.allowVaultContext,
            allowWebResearch: nextValues.allowWebResearch,
            kimiThinkingMode: nextValues.kimiThinkingMode,
            preferKimiMemory: nextValues.preferKimiMemory,
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

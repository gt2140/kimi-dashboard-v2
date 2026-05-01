import { z } from "zod";
import { createRouter, authedQuery, publicQuery } from "./middleware.js";
import { AGENTS } from "../../src/lib/data.js";

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
  kimiThinkingMode: z.enum(["enabled", "disabled"]).optional(),
  preferKimiMemory: z.boolean().optional(),
  enabledFormulaTools: z.array(z.string()).optional(),
  allowedContextOverrides: z.array(z.string()).optional(),
});

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
  systemPrompt?: string | null;
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

type AgentSettingsRecord = AgentSettingView & {
  agent: AgentView;
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

function buildDefaultSetting(
  userId: number,
  agent: (typeof AGENTS)[number],
): AgentSettingView {
  return {
    userId,
    agentDefinitionId: 0,
    isFavorite: agent.id === "generalist",
    isEnabled: true,
    customContext: null,
    trainingNotes: null,
    responseStyle: "detailed",
    preferredProviderId: null,
    preferredModelId: null,
    allowVaultContext: true,
    allowWebResearch: true,
    allowScientificResearch: false,
    kimiThinkingMode: "disabled",
    preferKimiMemory: false,
    enabledFormulaTools: [],
    allowedContextOverrides: agent.allowedVaultCategories,
  };
}

export const agentsRouter = createRouter({
  list: publicQuery.query(async () => {
    return AGENTS.map(mapAgent) as AgentView[];
  }),

  getById: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const agent = AGENTS.find(candidate => candidate.id === input.id);
      if (!agent) {
        throw new Error("Agent not found");
      }

      return mapAgent(agent);
    }),

  listProviders: publicQuery.query(async () => {
    return [] as ProviderView[];
  }),

  listUserSettings: authedQuery.query(async ({ ctx }) => {
    return AGENTS.map(agent => ({
      agent: mapAgent(agent),
      ...buildDefaultSetting(ctx.user.id, agent),
    })) as AgentSettingsRecord[];
  }),

  getUserSettings: authedQuery
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      const agent = AGENTS.find(candidate => candidate.id === input.slug);
      if (!agent) {
        throw new Error("Agent not found");
      }

      return {
        agent: mapAgent(agent),
        setting: buildDefaultSetting(ctx.user.id, agent),
      };
    }),

  saveUserSettings: authedQuery
    .input(userAgentSettingsInput)
    .mutation(async ({ input, ctx }) => {
      const agent = AGENTS.find(candidate => candidate.id === input.slug);
      if (!agent) {
        throw new Error("Agent not found");
      }

      return {
        agent: mapAgent(agent),
        setting: {
          ...buildDefaultSetting(ctx.user.id, agent),
          isFavorite: input.isFavorite ?? agent.id === "generalist",
          isEnabled: input.isEnabled ?? true,
          customContext: input.customContext ?? null,
          trainingNotes: input.trainingNotes ?? null,
          responseStyle: input.responseStyle ?? "detailed",
          preferredProviderId: input.preferredProviderId ?? null,
          preferredModelId: input.preferredModelId ?? null,
          allowVaultContext: input.allowVaultContext ?? true,
          allowWebResearch: input.allowWebResearch ?? true,
          allowScientificResearch: input.allowScientificResearch ?? false,
          kimiThinkingMode: input.kimiThinkingMode ?? "disabled",
          preferKimiMemory: input.preferKimiMemory ?? false,
          enabledFormulaTools: input.enabledFormulaTools ?? [],
          allowedContextOverrides:
            input.allowedContextOverrides ?? agent.allowedVaultCategories,
        },
      };
    }),

  bootstrapCatalog: publicQuery.mutation(async () => {
    return { ok: true, count: AGENTS.length };
  }),
});

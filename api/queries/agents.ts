import { and, asc, eq } from "drizzle-orm";
import { AGENTS } from "@/lib/data";
import {
  agentDefinitions,
  modelEndpoints,
  modelProviders,
  promptTemplates,
  userAgentSettings,
  type InsertAgentDefinition,
} from "@db/schema";
import { getDb } from "./connection";

const PROVIDER_SEEDS = [
  {
    slug: "openai",
    name: "OpenAI",
    authStrategy: "api_key",
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsVision: true,
    endpoint: {
      modelName: "gpt-5.4-mini",
      label: "GPT-5.4 Mini",
      supportsTools: true,
      supportsReasoning: true,
      supportsVision: true,
      maxContextTokens: 128000,
    },
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    authStrategy: "api_key",
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsVision: true,
    endpoint: {
      modelName: "default",
      label: "Default routing model",
      supportsTools: true,
      supportsReasoning: true,
      supportsVision: true,
      maxContextTokens: 200000,
    },
  },
  {
    slug: "kimi",
    name: "Kimi",
    authStrategy: "api_key",
    supportsTools: false,
    supportsStreaming: true,
    supportsJsonMode: false,
    supportsVision: true,
    endpoint: {
      modelName: "default",
      label: "Default routing model",
      supportsTools: false,
      supportsReasoning: true,
      supportsVision: true,
      maxContextTokens: 128000,
    },
  },
  {
    slug: "deepseek",
    name: "DeepSeek",
    authStrategy: "api_key",
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsVision: false,
    endpoint: {
      modelName: "default",
      label: "Default routing model",
      supportsTools: true,
      supportsReasoning: true,
      supportsVision: false,
      maxContextTokens: 128000,
    },
  },
];

function buildAgentCapabilities(agent: (typeof AGENTS)[number]) {
  return {
    vault_access: true,
    web_search: true,
    scientific_search: agent.tags?.includes("research") ?? false,
    multi_agent_consult: true,
    citation_mode: agent.tags?.includes("evidence") ?? false,
  };
}

function buildAgentSeed(agent: (typeof AGENTS)[number]): InsertAgentDefinition {
  return {
    slug: agent.id,
    name: agent.name,
    description: agent.description,
    longDescription: agent.longDescription,
    icon: agent.icon,
    color: agent.color,
    status: "active",
    visibility: "public",
    defaultRole: agent.id === "generalist" ? "primary" : "supporting",
    source: "marketplace",
    author: agent.author ?? "Aura Marketplace",
    installs: agent.installs ?? 0,
    rating:
      typeof agent.rating === "number" ? agent.rating.toFixed(2) : undefined,
    allowedVaultCategories: agent.allowedVaultCategories,
    tags: agent.tags ?? [],
    capabilities: buildAgentCapabilities(agent),
  };
}

let bootstrapPromise: Promise<void> | null = null;

export async function ensureConversationalCatalogSeeded() {
  if (!bootstrapPromise) {
    bootstrapPromise = seedConversationalCatalog().catch(error => {
      bootstrapPromise = null;
      throw mapConversationalSchemaError(error);
    });
  }
  return bootstrapPromise;
}

function mapConversationalSchemaError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('relation "model_providers" does not exist') ||
      message.includes('relation "agent_definitions" does not exist') ||
      (message.includes('column "') && message.includes('" does not exist')) ||
      (message.includes("column ") && message.includes(" does not exist")) ||
      (message.includes('type "') && message.includes('" does not exist')) ||
      message.includes("does not exist")
    ) {
      return new Error(
        "Conversational schema is not fully installed in Supabase yet. Re-run app/supabase/init.sql in the Supabase SQL Editor before using the agents system."
      );
    }
  }

  return error instanceof Error
    ? error
    : new Error("Conversational catalog bootstrap failed unexpectedly.");
}

async function seedConversationalCatalog() {
  const db = getDb();

  for (const provider of PROVIDER_SEEDS) {
    const providerResult = await db
      .insert(modelProviders)
      .values({
        slug: provider.slug,
        name: provider.name,
        status: "active",
        authStrategy: provider.authStrategy,
        supportsTools: provider.supportsTools,
        supportsStreaming: provider.supportsStreaming,
        supportsJsonMode: provider.supportsJsonMode,
        supportsVision: provider.supportsVision,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: modelProviders.slug,
        set: {
          name: provider.name,
          status: "active",
          authStrategy: provider.authStrategy,
          supportsTools: provider.supportsTools,
          supportsStreaming: provider.supportsStreaming,
          supportsJsonMode: provider.supportsJsonMode,
          supportsVision: provider.supportsVision,
          updatedAt: new Date(),
        },
      })
      .returning({ id: modelProviders.id });

    const providerId = providerResult[0]?.id;
    if (!providerId) continue;

    await db
      .insert(modelEndpoints)
      .values({
        providerId,
        modelName: provider.endpoint.modelName,
        label: provider.endpoint.label,
        status: "active",
        supportsTools: provider.endpoint.supportsTools,
        supportsReasoning: provider.endpoint.supportsReasoning,
        supportsVision: provider.endpoint.supportsVision,
        maxContextTokens: provider.endpoint.maxContextTokens,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [modelEndpoints.providerId, modelEndpoints.modelName],
        set: {
          label: provider.endpoint.label,
          status: "active",
          supportsTools: provider.endpoint.supportsTools,
          supportsReasoning: provider.endpoint.supportsReasoning,
          supportsVision: provider.endpoint.supportsVision,
          maxContextTokens: provider.endpoint.maxContextTokens,
          updatedAt: new Date(),
        },
      });
  }

  for (const agent of AGENTS) {
    const seed = buildAgentSeed(agent);
    const result = await db
      .insert(agentDefinitions)
      .values(seed)
      .onConflictDoUpdate({
        target: agentDefinitions.slug,
        set: {
          name: seed.name,
          description: seed.description,
          longDescription: seed.longDescription,
          icon: seed.icon,
          color: seed.color,
          status: seed.status,
          visibility: seed.visibility,
          defaultRole: seed.defaultRole,
          source: seed.source,
          author: seed.author,
          installs: seed.installs,
          rating: seed.rating,
          allowedVaultCategories: seed.allowedVaultCategories,
          tags: seed.tags,
          capabilities: seed.capabilities,
          updatedAt: new Date(),
        },
      })
      .returning({ id: agentDefinitions.id });

    const agentDefinitionId = result[0]?.id;
    if (!agentDefinitionId) continue;

    await db
      .insert(promptTemplates)
      .values({
        agentDefinitionId,
        kind: "system",
        version: 1,
        templateText: agent.systemPrompt,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [
          promptTemplates.agentDefinitionId,
          promptTemplates.kind,
          promptTemplates.version,
        ],
        set: {
          templateText: agent.systemPrompt,
          isActive: true,
        },
      });
  }
}

export async function listAgentDefinitions() {
  await ensureConversationalCatalogSeeded();
  return getDb().select().from(agentDefinitions).orderBy(asc(agentDefinitions.name));
}

export async function getAgentDefinitionBySlug(slug: string) {
  await ensureConversationalCatalogSeeded();
  const rows = await getDb()
    .select()
    .from(agentDefinitions)
    .where(eq(agentDefinitions.slug, slug))
    .limit(1);
  return rows[0];
}

export async function getActiveSystemPrompt(agentDefinitionId: number) {
  await ensureConversationalCatalogSeeded();
  const rows = await getDb()
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.agentDefinitionId, agentDefinitionId),
        eq(promptTemplates.kind, "system"),
        eq(promptTemplates.isActive, true)
      )
    )
    .orderBy(asc(promptTemplates.version));

  return rows.at(-1) ?? null;
}

export async function listModelProvidersWithEndpoints() {
  await ensureConversationalCatalogSeeded();
  const providers = await getDb()
    .select()
    .from(modelProviders)
    .orderBy(asc(modelProviders.name));
  const endpoints = await getDb()
    .select()
    .from(modelEndpoints)
    .orderBy(asc(modelEndpoints.label));

  return providers.map(provider => ({
    ...provider,
    endpoints: endpoints.filter(endpoint => endpoint.providerId === provider.id),
  }));
}

export async function getUserAgentSetting(userId: number, agentDefinitionId: number) {
  await ensureConversationalCatalogSeeded();
  const rows = await getDb()
    .select()
    .from(userAgentSettings)
    .where(
      and(
        eq(userAgentSettings.userId, userId),
        eq(userAgentSettings.agentDefinitionId, agentDefinitionId)
      )
    )
    .limit(1);

  return rows[0];
}

export async function listUserAgentSettings(userId: number) {
  await ensureConversationalCatalogSeeded();
  return getDb()
    .select({
      id: userAgentSettings.id,
      userId: userAgentSettings.userId,
      agentDefinitionId: userAgentSettings.agentDefinitionId,
      isFavorite: userAgentSettings.isFavorite,
      isEnabled: userAgentSettings.isEnabled,
      customContext: userAgentSettings.customContext,
      trainingNotes: userAgentSettings.trainingNotes,
      responseStyle: userAgentSettings.responseStyle,
      preferredProviderId: userAgentSettings.preferredProviderId,
      preferredModelId: userAgentSettings.preferredModelId,
      allowVaultContext: userAgentSettings.allowVaultContext,
      allowWebResearch: userAgentSettings.allowWebResearch,
      allowScientificResearch: userAgentSettings.allowScientificResearch,
      allowedContextOverrides: userAgentSettings.allowedContextOverrides,
      createdAt: userAgentSettings.createdAt,
      updatedAt: userAgentSettings.updatedAt,
      agent: {
        id: agentDefinitions.id,
        slug: agentDefinitions.slug,
        name: agentDefinitions.name,
        icon: agentDefinitions.icon,
        color: agentDefinitions.color,
      },
    })
    .from(userAgentSettings)
    .innerJoin(
      agentDefinitions,
      eq(userAgentSettings.agentDefinitionId, agentDefinitions.id)
    )
    .where(eq(userAgentSettings.userId, userId))
    .orderBy(asc(agentDefinitions.name));
}

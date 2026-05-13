import { and, asc, eq, inArray } from "drizzle-orm";
import { AGENTS } from "../../src/lib/data.js";
import {
  agentDefinitions,
  modelEndpoints,
  modelProviders,
  promptTemplates,
  userAgentSettings,
  type InsertAgentDefinition,
} from "../../db/schema.js";
import { getDb } from "./connection.js";
import { logServerDebug } from "../lib/debug.js";

const PROVIDER_SEEDS = [
  {
    slug: "kimi",
    name: "Kimi",
    authStrategy: "api_key",
    supportsTools: true,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsVision: true,
    endpoint: {
      modelName: "kimi-k2.6",
      label: "Kimi K2.6",
      supportsTools: true,
      supportsReasoning: true,
      supportsVision: true,
      maxContextTokens: 256000,
    },
  },
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
    slug: "venice",
    name: "Venice",
    authStrategy: "api_key",
    supportsTools: false,
    supportsStreaming: true,
    supportsJsonMode: true,
    supportsVision: false,
    endpoint: {
      modelName: "zai-org-glm-5-1",
      label: "GLM 5.1",
      supportsTools: false,
      supportsReasoning: true,
      supportsVision: false,
      maxContextTokens: 200000,
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

const CANONICAL_AGENT_SLUGS = AGENTS.map(agent => agent.id);

export function getCanonicalAgentSlugs() {
  return [...CANONICAL_AGENT_SLUGS];
}

function buildAgentCapabilities(agent: (typeof AGENTS)[number]) {
  return {
    vault_access: true,
    web_search: true,
    scientific_search: agent.tags?.includes("research") ?? false,
    multi_agent_consult: agent.id === "generalist",
    citation_mode: agent.tags?.includes("evidence") ?? false,
    kimi_v1: true,
    kimi_memory: agent.id === "generalist",
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
    source: agent.source ?? "built-in",
    author: agent.author ?? "Aura",
    installs: agent.installs ?? 0,
    rating:
      typeof agent.rating === "number" ? agent.rating.toFixed(2) : undefined,
    allowedVaultCategories: agent.allowedVaultCategories,
    tags: agent.tags ?? [],
    capabilities: buildAgentCapabilities(agent),
  };
}

let bootstrapPromise: Promise<void> | null = null;
let catalogReady = false;

export async function ensureConversationalCatalogSeeded() {
  if (catalogReady) {
    return;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = ensureConversationalCatalogReady().catch(error => {
      bootstrapPromise = null;
      throw mapConversationalSchemaError(error);
    });
  }
  return bootstrapPromise;
}

export function isConversationalCatalogReadyFromCounts(counts: {
  providerCount: number;
  agentCount: number;
  promptCount: number;
}) {
  return (
    counts.providerCount >= PROVIDER_SEEDS.length &&
    counts.agentCount >= AGENTS.length &&
    counts.promptCount >= AGENTS.length
  );
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
  const providerReferences = new Map<
    string,
    {
      providerId: number;
      modelEndpointId: number | null;
    }
  >();

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
      })
      .returning({ id: modelEndpoints.id });

    const endpointRows = await db
      .select({ id: modelEndpoints.id })
      .from(modelEndpoints)
      .where(
        and(
          eq(modelEndpoints.providerId, providerId),
          eq(modelEndpoints.modelName, provider.endpoint.modelName)
        )
      )
      .limit(1);

    providerReferences.set(provider.slug, {
      providerId,
      modelEndpointId: endpointRows[0]?.id ?? null,
    });
  }

  for (const agent of AGENTS) {
    const seed = buildAgentSeed(agent);
    const kimiReference = providerReferences.get("kimi");
    const result = await db
      .insert(agentDefinitions)
      .values({
        ...seed,
        defaultProviderId: kimiReference?.providerId ?? null,
        defaultModelId: kimiReference?.modelEndpointId ?? null,
      })
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
          defaultProviderId: kimiReference?.providerId ?? null,
          defaultModelId: kimiReference?.modelEndpointId ?? null,
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

async function ensureConversationalCatalogReady() {
  const readiness = await readConversationalCatalogCounts();

  if (isConversationalCatalogReadyFromCounts(readiness)) {
    logServerDebug("agents.catalog.sync.start", readiness);
    await seedConversationalCatalog();
    catalogReady = true;
    logServerDebug("agents.catalog.ready", {
      ...readiness,
      syncedCanonicalAgents: AGENTS.length,
    });
    return;
  }

  logServerDebug("agents.catalog.seed.start", readiness);
  await seedConversationalCatalog();
  catalogReady = true;
  logServerDebug("agents.catalog.seed.completed", {
    providerCount: PROVIDER_SEEDS.length,
    agentCount: AGENTS.length,
    promptCount: AGENTS.length,
  });
}

async function readConversationalCatalogCounts() {
  const db = getDb();
  const [providers, agents, prompts] = await Promise.all([
    db.select({ id: modelProviders.id }).from(modelProviders).limit(PROVIDER_SEEDS.length),
    db.select({ id: agentDefinitions.id }).from(agentDefinitions).limit(AGENTS.length),
    db.select({ id: promptTemplates.id }).from(promptTemplates).limit(AGENTS.length),
  ]);

  return {
    providerCount: providers.length,
    agentCount: agents.length,
    promptCount: prompts.length,
  };
}

export async function listAgentDefinitions() {
  await ensureConversationalCatalogSeeded();
  return getDb()
    .select()
    .from(agentDefinitions)
    .where(inArray(agentDefinitions.slug, CANONICAL_AGENT_SLUGS))
    .orderBy(asc(agentDefinitions.name));
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

  return rows.length > 0 ? rows[rows.length - 1] : null;
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
      kimiThinkingMode: userAgentSettings.kimiThinkingMode,
      preferKimiMemory: userAgentSettings.preferKimiMemory,
      enabledFormulaTools: userAgentSettings.enabledFormulaTools,
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
    .where(
      and(
        eq(userAgentSettings.userId, userId),
        inArray(agentDefinitions.slug, CANONICAL_AGENT_SLUGS)
      )
    )
    .orderBy(asc(agentDefinitions.name));
}

import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);
export const vaultCategoryEnum = pgEnum("vault_category", [
  "bloodwork",
  "genetics",
  "wearables",
  "body-composition",
  "notes",
  "other",
]);
export const vaultStatusEnum = pgEnum("vault_status", [
  "ready",
  "processing",
  "failed",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "active",
  "draft",
  "archived",
]);
export const agentVisibilityEnum = pgEnum("agent_visibility", [
  "public",
  "internal",
]);
export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "archived",
]);
export const orchestrationModeEnum = pgEnum("orchestration_mode", [
  "single_agent",
  "primary_plus_supporting",
  "review_loop",
]);
export const conversationAgentRoleEnum = pgEnum("conversation_agent_role", [
  "primary",
  "supporting",
  "reviewer",
  "synthesizer",
]);
export const promptTemplateKindEnum = pgEnum("prompt_template_kind", [
  "system",
  "developer",
  "planner",
  "reviewer",
  "synthesizer",
]);
export const providerStatusEnum = pgEnum("provider_status", [
  "active",
  "disabled",
  "experimental",
]);
export const modelStatusEnum = pgEnum("model_status", [
  "active",
  "disabled",
  "deprecated",
]);
export const runStatusEnum = pgEnum("run_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);
export const runTypeEnum = pgEnum("run_type", [
  "primary_reply",
  "supporting_consult",
  "review",
  "synthesis",
]);
export const messageKindEnum = pgEnum("message_kind", [
  "user",
  "assistant",
  "system",
  "tool",
  "agent_internal",
]);
export const contextSourceTypeEnum = pgEnum("context_source_type", [
  "vault_file",
  "vault_chunk",
  "user_note",
  "conversation_summary",
  "agent_setting",
  "web_result",
  "scientific_result",
  "manual_attachment",
]);
export const responseStyleEnum = pgEnum("response_style", [
  "concise",
  "detailed",
  "academic",
]);
export const kimiThinkingModeEnum = pgEnum("kimi_thinking_mode", [
  "enabled",
  "disabled",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("union_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const modelProviders = pgTable(
  "model_providers",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    status: providerStatusEnum("status").default("active").notNull(),
    baseUrl: text("base_url"),
    authStrategy: varchar("auth_strategy", { length: 64 })
      .default("api_key")
      .notNull(),
    supportsTools: boolean("supports_tools").default(false).notNull(),
    supportsStreaming: boolean("supports_streaming").default(true).notNull(),
    supportsJsonMode: boolean("supports_json_mode").default(false).notNull(),
    supportsVision: boolean("supports_vision").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    slugIdx: uniqueIndex("model_providers_slug_idx").on(table.slug),
  })
);

export const modelEndpoints = pgTable(
  "model_endpoints",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => modelProviders.id, { onDelete: "cascade" }),
    modelName: varchar("model_name", { length: 120 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    status: modelStatusEnum("status").default("active").notNull(),
    inputCostPerMillion: numeric("input_cost_per_million", {
      precision: 12,
      scale: 4,
    }),
    outputCostPerMillion: numeric("output_cost_per_million", {
      precision: 12,
      scale: 4,
    }),
    supportsTools: boolean("supports_tools").default(false).notNull(),
    supportsReasoning: boolean("supports_reasoning").default(false).notNull(),
    supportsVision: boolean("supports_vision").default(false).notNull(),
    maxContextTokens: integer("max_context_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    providerModelIdx: uniqueIndex("model_endpoints_provider_model_idx").on(
      table.providerId,
      table.modelName
    ),
  })
);

export const agentDefinitions = pgTable(
  "agent_definitions",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    longDescription: text("long_description"),
    icon: varchar("icon", { length: 80 }).notNull(),
    color: varchar("color", { length: 80 }),
    status: agentStatusEnum("status").default("active").notNull(),
    visibility: agentVisibilityEnum("visibility").default("public").notNull(),
    defaultRole: conversationAgentRoleEnum("default_role")
      .default("supporting")
      .notNull(),
    source: varchar("source", { length: 32 }).default("marketplace").notNull(),
    author: varchar("author", { length: 255 }),
    installs: integer("installs").default(0).notNull(),
    rating: numeric("rating", { precision: 3, scale: 2 }),
    allowedVaultCategories: jsonb("allowed_vault_categories")
      .$type<string[]>()
      .default([])
      .notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    capabilities: jsonb("capabilities")
      .$type<Record<string, boolean | string | number | null>>()
      .default({})
      .notNull(),
    defaultProviderId: integer("default_provider_id").references(
      () => modelProviders.id,
      { onDelete: "set null" }
    ),
    defaultModelId: integer("default_model_id").references(
      () => modelEndpoints.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    slugIdx: uniqueIndex("agent_definitions_slug_idx").on(table.slug),
  })
);

export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: serial("id").primaryKey(),
    agentDefinitionId: integer("agent_definition_id")
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: "cascade" }),
    kind: promptTemplateKindEnum("kind").notNull(),
    version: integer("version").default(1).notNull(),
    templateText: text("template_text").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    promptVersionIdx: uniqueIndex("prompt_templates_agent_kind_version_idx").on(
      table.agentDefinitionId,
      table.kind,
      table.version
    ),
  })
);

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  agentId: varchar("agent_id", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }),
  status: conversationStatusEnum("status").default("active").notNull(),
  summary: text("summary"),
  orchestrationMode: orchestrationModeEnum("orchestration_mode")
    .default("single_agent")
    .notNull(),
  lastAgentRunAt: timestamp("last_agent_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const conversationAgents = pgTable(
  "conversation_agents",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    agentDefinitionId: integer("agent_definition_id")
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: "cascade" }),
    role: conversationAgentRoleEnum("role").notNull(),
    addedByUser: boolean("added_by_user").default(false).notNull(),
    position: integer("position").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    conversationAgentIdx: uniqueIndex("conversation_agents_unique_idx").on(
      table.conversationId,
      table.agentDefinitionId,
      table.role
    ),
  })
);

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  kind: messageKindEnum("kind").default("user").notNull(),
  parentMessageId: integer("parent_message_id"),
  finalized: boolean("finalized").default(true).notNull(),
  visibleToUser: boolean("visible_to_user").default(true).notNull(),
  content: text("content").notNull(),
  agentId: varchar("agent_id", { length: 50 }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const vaultFiles = pgTable("vault_files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 64 }).notNull(),
  category: vaultCategoryEnum("category").default("other").notNull(),
  size: integer("size").notNull(),
  status: vaultStatusEnum("status").default("ready").notNull(),
  extractionStatus: varchar("extraction_status", { length: 32 })
    .default("pending")
    .notNull(),
  encryptedUrl: text("encrypted_url"),
  iv: varchar("iv", { length: 255 }),
  remoteFileId: varchar("remote_file_id", { length: 255 }),
  extractedText: text("extracted_text"),
  contentHash: varchar("content_hash", { length: 128 }),
  extractionError: text("extraction_error"),
  extractedAt: timestamp("extracted_at", { withTimezone: true }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const vaultChunks = pgTable("vault_chunks", {
  id: serial("id").primaryKey(),
  vaultFileId: integer("vault_file_id")
    .notNull()
    .references(() => vaultFiles.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userAgentSettings = pgTable(
  "user_agent_settings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentDefinitionId: integer("agent_definition_id")
      .notNull()
      .references(() => agentDefinitions.id, { onDelete: "cascade" }),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    customContext: text("custom_context"),
    trainingNotes: text("training_notes"),
    responseStyle: responseStyleEnum("response_style")
      .default("detailed")
      .notNull(),
    preferredProviderId: integer("preferred_provider_id").references(
      () => modelProviders.id,
      { onDelete: "set null" }
    ),
    preferredModelId: integer("preferred_model_id").references(
      () => modelEndpoints.id,
      { onDelete: "set null" }
    ),
    allowVaultContext: boolean("allow_vault_context").default(true).notNull(),
    allowWebResearch: boolean("allow_web_research").default(true).notNull(),
    allowScientificResearch: boolean("allow_scientific_research")
      .default(false)
      .notNull(),
    kimiThinkingMode: kimiThinkingModeEnum("kimi_thinking_mode")
      .default("enabled")
      .notNull(),
    preferKimiMemory: boolean("prefer_kimi_memory").default(true).notNull(),
    enabledFormulaTools: jsonb("enabled_formula_tools")
      .$type<string[]>()
      .default([])
      .notNull(),
    allowedContextOverrides: jsonb("allowed_context_overrides")
      .$type<string[]>()
      .default([])
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    userAgentIdx: uniqueIndex("user_agent_settings_unique_idx").on(
      table.userId,
      table.agentDefinitionId
    ),
  })
);

export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => messages.id, {
    onDelete: "set null",
  }),
  agentDefinitionId: integer("agent_definition_id")
    .notNull()
    .references(() => agentDefinitions.id, { onDelete: "cascade" }),
  conversationAgentId: integer("conversation_agent_id").references(
    () => conversationAgents.id,
    { onDelete: "set null" }
  ),
  parentRunId: integer("parent_run_id"),
  runType: runTypeEnum("run_type").notNull(),
  providerId: integer("provider_id").references(() => modelProviders.id, {
    onDelete: "set null",
  }),
  modelEndpointId: integer("model_endpoint_id").references(
    () => modelEndpoints.id,
    { onDelete: "set null" }
  ),
  status: runStatusEnum("status").default("queued").notNull(),
  inputMessagesJson: jsonb("input_messages_json")
    .$type<unknown[]>()
    .default([])
    .notNull(),
  resolvedSystemPrompt: text("resolved_system_prompt"),
  resolvedUserContext: text("resolved_user_context"),
  outputText: text("output_text"),
  outputJson: jsonb("output_json").$type<Record<string, unknown> | null>(),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
  errorMessage: text("error_message"),
  providerRequestId: varchar("provider_request_id", { length: 255 }),
  finishReason: varchar("finish_reason", { length: 64 }),
  thinkingMode: kimiThinkingModeEnum("thinking_mode"),
  toolCallsJson: jsonb("tool_calls_json").$type<unknown[]>().default([]).notNull(),
  usageJson: jsonb("usage_json")
    .$type<Record<string, unknown> | null>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const messageContextBlocks = pgTable("message_context_blocks", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => messages.id, {
    onDelete: "set null",
  }),
  agentRunId: integer("agent_run_id").references(() => agentRuns.id, {
    onDelete: "set null",
  }),
  sourceType: contextSourceTypeEnum("source_type").notNull(),
  sourceId: varchar("source_id", { length: 255 }),
  title: varchar("title", { length: 255 }),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  relevanceScore: numeric("relevance_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const conversationMemories = pgTable("conversation_memories", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  sourceRunId: integer("source_run_id").references(() => agentRuns.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userMemories = pgTable("user_memories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  memoryKey: varchar("memory_key", { length: 120 }).notNull(),
  value: text("value").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 2 }),
  sourceRunId: integer("source_run_id").references(() => agentRuns.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type VaultFile = typeof vaultFiles.$inferSelect;
export type VaultChunk = typeof vaultChunks.$inferSelect;
export type AgentDefinition = typeof agentDefinitions.$inferSelect;
export type InsertAgentDefinition = typeof agentDefinitions.$inferInsert;
export type UserAgentSetting = typeof userAgentSettings.$inferSelect;
export type InsertUserAgentSetting = typeof userAgentSettings.$inferInsert;
export type ModelProvider = typeof modelProviders.$inferSelect;
export type ModelEndpoint = typeof modelEndpoints.$inferSelect;
export type ConversationMemory = typeof conversationMemories.$inferSelect;
export type UserMemory = typeof userMemories.$inferSelect;

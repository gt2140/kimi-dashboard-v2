import { relations } from "drizzle-orm";
import {
  agentDefinitions,
  agentRuns,
  conversationAgents,
  conversations,
  messageContextBlocks,
  messages,
  modelEndpoints,
  modelProviders,
  promptTemplates,
  userAgentSettings,
  users,
  vaultFiles,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  vaultFiles: many(vaultFiles),
  agentSettings: many(userAgentSettings),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
  conversationAgents: many(conversationAgents),
  agentRuns: many(agentRuns),
  contextBlocks: many(messageContextBlocks),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  agentRuns: many(agentRuns),
  contextBlocks: many(messageContextBlocks),
}));

export const vaultFilesRelations = relations(vaultFiles, ({ one }) => ({
  user: one(users, {
    fields: [vaultFiles.userId],
    references: [users.id],
  }),
}));

export const modelProvidersRelations = relations(modelProviders, ({ many }) => ({
  endpoints: many(modelEndpoints),
  agentDefinitions: many(agentDefinitions),
  userAgentSettings: many(userAgentSettings),
  agentRuns: many(agentRuns),
}));

export const modelEndpointsRelations = relations(modelEndpoints, ({ one, many }) => ({
  provider: one(modelProviders, {
    fields: [modelEndpoints.providerId],
    references: [modelProviders.id],
  }),
  agentDefinitions: many(agentDefinitions),
  userAgentSettings: many(userAgentSettings),
  agentRuns: many(agentRuns),
}));

export const agentDefinitionsRelations = relations(
  agentDefinitions,
  ({ one, many }) => ({
    defaultProvider: one(modelProviders, {
      fields: [agentDefinitions.defaultProviderId],
      references: [modelProviders.id],
    }),
    defaultModel: one(modelEndpoints, {
      fields: [agentDefinitions.defaultModelId],
      references: [modelEndpoints.id],
    }),
    promptTemplates: many(promptTemplates),
    userSettings: many(userAgentSettings),
    conversationAgents: many(conversationAgents),
    agentRuns: many(agentRuns),
  })
);

export const promptTemplatesRelations = relations(promptTemplates, ({ one }) => ({
  agentDefinition: one(agentDefinitions, {
    fields: [promptTemplates.agentDefinitionId],
    references: [agentDefinitions.id],
  }),
}));

export const userAgentSettingsRelations = relations(
  userAgentSettings,
  ({ one }) => ({
    user: one(users, {
      fields: [userAgentSettings.userId],
      references: [users.id],
    }),
    agentDefinition: one(agentDefinitions, {
      fields: [userAgentSettings.agentDefinitionId],
      references: [agentDefinitions.id],
    }),
    preferredProvider: one(modelProviders, {
      fields: [userAgentSettings.preferredProviderId],
      references: [modelProviders.id],
    }),
    preferredModel: one(modelEndpoints, {
      fields: [userAgentSettings.preferredModelId],
      references: [modelEndpoints.id],
    }),
  })
);

export const conversationAgentsRelations = relations(
  conversationAgents,
  ({ one, many }) => ({
    conversation: one(conversations, {
      fields: [conversationAgents.conversationId],
      references: [conversations.id],
    }),
    agentDefinition: one(agentDefinitions, {
      fields: [conversationAgents.agentDefinitionId],
      references: [agentDefinitions.id],
    }),
    agentRuns: many(agentRuns),
  })
);

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [agentRuns.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [agentRuns.messageId],
    references: [messages.id],
  }),
  agentDefinition: one(agentDefinitions, {
    fields: [agentRuns.agentDefinitionId],
    references: [agentDefinitions.id],
  }),
  conversationAgent: one(conversationAgents, {
    fields: [agentRuns.conversationAgentId],
    references: [conversationAgents.id],
  }),
  provider: one(modelProviders, {
    fields: [agentRuns.providerId],
    references: [modelProviders.id],
  }),
  modelEndpoint: one(modelEndpoints, {
    fields: [agentRuns.modelEndpointId],
    references: [modelEndpoints.id],
  }),
  contextBlocks: many(messageContextBlocks),
}));

export const messageContextBlocksRelations = relations(
  messageContextBlocks,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [messageContextBlocks.conversationId],
      references: [conversations.id],
    }),
    message: one(messages, {
      fields: [messageContextBlocks.messageId],
      references: [messages.id],
    }),
    agentRun: one(agentRuns, {
      fields: [messageContextBlocks.agentRunId],
      references: [agentRuns.id],
    }),
  })
);

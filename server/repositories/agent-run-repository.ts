import { and, eq } from "drizzle-orm";
import { agentRuns, messageContextBlocks, modelEndpoints, modelProviders } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";

export async function resolveModelReference(
  providerSlug: string,
  modelName: string
) {
  const db = getDb();
  const providerRows = await db
    .select({ id: modelProviders.id })
    .from(modelProviders)
    .where(eq(modelProviders.slug, providerSlug))
    .limit(1);

  const providerId = providerRows[0]?.id ?? null;
  if (!providerId) {
    return {
      providerId: null,
      modelEndpointId: null,
    };
  }

  const endpointRows = await db
    .select({ id: modelEndpoints.id })
    .from(modelEndpoints)
    .where(
      and(
        eq(modelEndpoints.providerId, providerId),
        eq(modelEndpoints.modelName, modelName)
      )
    )
    .limit(1);

  if (!endpointRows[0]) {
    const fallbackEndpointRows = await db
      .select({ id: modelEndpoints.id })
      .from(modelEndpoints)
      .where(eq(modelEndpoints.providerId, providerId))
      .limit(1);

    return {
      providerId,
      modelEndpointId: fallbackEndpointRows[0]?.id ?? null,
    };
  }

  return {
    providerId,
    modelEndpointId: endpointRows[0]?.id ?? null,
  };
}

type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type SupportingRunRecord = {
  agentDefinitionId: number | null;
  agentName: string;
  inputMessages: ModelMessage[];
  systemPrompt: string | null;
  content: string;
  status: "completed" | "failed";
  providerSlug: string;
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage: string | null;
};

export class AgentRunRepository {
  async createPrimaryRun(params: {
    conversationId: number;
    agentDefinitionId: number;
    resolvedUserContext: string;
  }) {
    const db = getDb();
    const inserted = await db
      .insert(agentRuns)
      .values({
        conversationId: params.conversationId,
        agentDefinitionId: params.agentDefinitionId,
        runType: "primary_reply",
        status: "queued",
        resolvedUserContext: params.resolvedUserContext,
      })
      .returning({ id: agentRuns.id });

    const primaryRun = inserted[0];
    if (!primaryRun) {
      throw new Error("Failed to create the primary agent run.");
    }

    return primaryRun;
  }

  async markPrimaryRunRunning(runId: number) {
    const db = getDb();
    await db
      .update(agentRuns)
      .set({
        status: "running",
        startedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId));
  }

  async finalizePrimaryRun(
    runId: number,
    params: {
      messageId: number;
      providerId: number | null;
      modelEndpointId: number | null;
      status: "completed" | "failed";
      inputMessages: ModelMessage[];
      systemPrompt: string;
      outputText: string;
      inputTokens?: number;
      outputTokens?: number;
      errorMessage?: string | null;
      providerRequestId?: string | null;
      finishReason?: string | null;
      thinkingMode?: "enabled" | "disabled" | null;
      toolCallsJson?: unknown[];
      usageJson?: Record<string, unknown> | null;
    }
  ) {
    const db = getDb();
    await db
      .update(agentRuns)
      .set({
        messageId: params.messageId,
        providerId: params.providerId,
        modelEndpointId: params.modelEndpointId,
        status: params.status,
        inputMessagesJson: params.inputMessages,
        resolvedSystemPrompt: params.systemPrompt,
        outputText: params.outputText,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        errorMessage: params.errorMessage ?? null,
        providerRequestId: params.providerRequestId ?? null,
        finishReason: params.finishReason ?? null,
        thinkingMode: params.thinkingMode ?? null,
        toolCallsJson: params.toolCallsJson ?? [],
        usageJson: params.usageJson ?? null,
        completedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId));
  }

  async finalizePrimaryRunFailure(
    runId: number,
    params: {
      errorMessage: string;
    }
  ) {
    const db = getDb();
    await db
      .update(agentRuns)
      .set({
        status: "failed",
        errorMessage: params.errorMessage,
        completedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId));
  }

  async createSupportingRuns(params: {
    conversationId: number;
    messageId: number;
    resolvedUserContext: string;
    runs: SupportingRunRecord[];
    modelReferences: Array<{
      providerId: number | null;
      modelEndpointId: number | null;
    }>;
  }) {
    const db = getDb();

    for (const [index, supportingRun] of params.runs.entries()) {
      if (!supportingRun.agentDefinitionId) {
        continue;
      }

      await db.insert(agentRuns).values({
        conversationId: params.conversationId,
        messageId: params.messageId,
        agentDefinitionId: supportingRun.agentDefinitionId,
        runType: "supporting_consult",
        providerId: params.modelReferences[index]?.providerId ?? null,
        modelEndpointId: params.modelReferences[index]?.modelEndpointId ?? null,
        status: supportingRun.status,
        inputMessagesJson: supportingRun.inputMessages,
        resolvedSystemPrompt: supportingRun.systemPrompt,
        resolvedUserContext: params.resolvedUserContext,
        outputText:
          supportingRun.content ||
          `Supporting consultation planned for ${supportingRun.agentName}.`,
        inputTokens: supportingRun.inputTokens,
        outputTokens: supportingRun.outputTokens,
        errorMessage:
          supportingRun.errorMessage ??
          "Supporting run result was not available.",
        completedAt: new Date(),
      });
    }
  }

  async createMessageContextBlocks(params: {
    conversationId: number;
    messageId: number;
    agentRunId: number;
    relatedVaultFiles: string[];
    vaultChunks?: Array<{
      vaultFileId: number;
      chunkIndex: number;
      content: string;
    }>;
    toolResults?: Array<{
      toolCallId: string;
      toolName: string;
      content: string;
    }>;
  }) {
    const db = getDb();

    for (const filename of params.relatedVaultFiles) {
      await db.insert(messageContextBlocks).values({
        conversationId: params.conversationId,
        messageId: params.messageId,
        agentRunId: params.agentRunId,
        sourceType: "vault_file",
        sourceId: filename,
        title: filename,
        content: `Vault file available to the run: ${filename}`,
        metadata: {
          relation: "accessible_vault_file",
        },
      });
    }

    for (const chunk of params.vaultChunks ?? []) {
      await db.insert(messageContextBlocks).values({
        conversationId: params.conversationId,
        messageId: params.messageId,
        agentRunId: params.agentRunId,
        sourceType: "vault_chunk",
        sourceId: `${chunk.vaultFileId}:${chunk.chunkIndex}`,
        title: `Vault chunk ${chunk.chunkIndex}`,
        content: chunk.content,
        metadata: {
          relation: "selected_vault_chunk",
          vaultFileId: chunk.vaultFileId,
          chunkIndex: chunk.chunkIndex,
        },
      });
    }

    for (const toolResult of params.toolResults ?? []) {
      await db.insert(messageContextBlocks).values({
        conversationId: params.conversationId,
        messageId: params.messageId,
        agentRunId: params.agentRunId,
        sourceType: "web_result",
        sourceId: toolResult.toolCallId,
        title: toolResult.toolName,
        content: toolResult.content,
        metadata: {
          relation: "tool_result",
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
        },
      });
    }
  }

  async saveToolCallBatch(params: {
    agentRunId: number;
    toolCalls: Array<{
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      };
    }>;
    toolResults: Array<{
      toolCallId: string;
      toolName: string;
      content: string;
    }>;
  }) {
    const db = getDb();
    await db
      .update(agentRuns)
      .set({
        toolCallsJson: params.toolCalls,
        outputJson: {
          toolResults: params.toolResults,
        },
      })
      .where(eq(agentRuns.id, params.agentRunId));
  }
}

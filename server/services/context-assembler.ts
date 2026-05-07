import { and, desc, eq } from "drizzle-orm";
import { conversations, messages } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";
import { resolveAgentExecutionProfile } from "./agent-registry.js";
import { vaultV2Service } from "./vault-v2-service.js";

export async function assembleConversationContext(params: {
  userId: number;
  conversationId: number;
  agentSlug: string;
  latestUserMessage: string;
}) {
  const db = getDb();
  const profile = await resolveAgentExecutionProfile({
    userId: params.userId,
    slug: params.agentSlug,
  });

  const [conversationRow] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, params.conversationId),
        eq(conversations.userId, params.userId)
      )
    )
    .limit(1);

  const recentMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(6);

  const allowedCategories = profile.resolved.allowVaultContext
    ? profile.resolved.allowedVaultCategories
    : [];

  let accessibleFiles: Array<{
    id: number;
    filename: string;
    category: string;
    status: string;
  }> = [];

  if (allowedCategories.length > 0) {
    try {
      const context = await vaultV2Service.loadContext({
        userId: params.userId,
        allowedCategories: allowedCategories as any,
        query: params.latestUserMessage,
        maxChunks: 4,
      });
      accessibleFiles = context.relatedVaultDocuments.map(document => ({
        id: document.id,
        filename: document.filename,
        category: document.category,
        status: "ready",
      }));
    } catch (error) {
      accessibleFiles = [];
    }
  }

  return {
    conversationSummary: conversationRow?.summary ?? null,
    recentMessages: recentMessages.reverse(),
    accessibleFiles,
    resolvedAgentProfile: profile.resolved,
    latestUserMessage: params.latestUserMessage,
  };
}

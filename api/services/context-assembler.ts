import { and, desc, eq, inArray } from "drizzle-orm";
import { conversations, messages, vaultFiles } from "@db/schema";
import { logServerError } from "../lib/debug";
import { getDb } from "../queries/connection";
import { resolveAgentExecutionProfile } from "./agent-registry";

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
    ? (profile.resolved.allowedVaultCategories as Array<
        (typeof vaultFiles.$inferSelect)["category"]
      >)
    : [];

  let accessibleFiles: Array<{
    id: number;
    filename: string;
    category: (typeof vaultFiles.$inferSelect)["category"];
    status: (typeof vaultFiles.$inferSelect)["status"];
  }> = [];

  if (allowedCategories.length > 0) {
    try {
      accessibleFiles = await db
        .select({
          id: vaultFiles.id,
          filename: vaultFiles.filename,
          category: vaultFiles.category,
          status: vaultFiles.status,
        })
        .from(vaultFiles)
        .where(
          and(
            eq(vaultFiles.userId, params.userId),
            inArray(vaultFiles.category, allowedCategories)
          )
        )
        .orderBy(desc(vaultFiles.updatedAt))
        .limit(4);
    } catch (error) {
      logServerError("context-assembler.vault-query.failed", error, {
        userId: params.userId,
        conversationId: params.conversationId,
        agentSlug: params.agentSlug,
      });
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

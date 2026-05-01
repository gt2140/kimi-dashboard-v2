import { desc, eq } from "drizzle-orm";
import { AGENTS } from "../../src/lib/data.js";
import { messages } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";

export async function loadKimiTurnContext(params: {
  userId: number;
  conversationId: number;
  agentSlug: string;
  latestUserMessage: string;
}) {
  const agent =
    AGENTS.find(candidate => candidate.id === params.agentSlug) ?? AGENTS[0];

  const recentMessages = await getDb()
    .select({
      role: messages.role,
      content: messages.content,
    })
    .from(messages)
    .where(eq(messages.conversationId, params.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(8);

  return {
    systemPrompt: agent.systemPrompt,
    responseStyle: "detailed" as const,
    recentMessages: recentMessages.reverse(),
    thinkingMode: "disabled" as const,
    promptCacheKey: `kimi:v1:conversation:${params.conversationId}`,
    safetyIdentifier: `user-${params.userId}`,
  };
}

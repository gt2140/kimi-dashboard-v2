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

  return {
    systemPrompt: agent.systemPrompt,
    responseStyle: "detailed" as const,
    recentMessages: [],
    thinkingMode: "disabled" as const,
    promptCacheKey: `kimi:v1:conversation:${params.conversationId}`,
    safetyIdentifier: `user-${params.userId}`,
  };
}

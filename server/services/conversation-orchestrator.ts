import { assembleConversationContext } from "./context-assembler.js";

export async function planConversationTurn(params: {
  userId: number;
  conversationId: number;
  primaryAgentSlug: string;
  supportingAgentSlugs?: string[];
  latestUserMessage: string;
}) {
  const primaryContext = await assembleConversationContext({
    userId: params.userId,
    conversationId: params.conversationId,
    agentSlug: params.primaryAgentSlug,
    latestUserMessage: params.latestUserMessage,
  });

  const supportingAgents = params.supportingAgentSlugs ?? [];
  const supportingContexts = await Promise.all(
    supportingAgents.map(agentSlug =>
      assembleConversationContext({
        userId: params.userId,
        conversationId: params.conversationId,
        agentSlug,
        latestUserMessage: params.latestUserMessage,
      }).then(context => ({
        agentSlug,
        context,
      }))
    )
  );

  return {
    primaryAgentSlug: params.primaryAgentSlug,
    supportingAgentSlugs: supportingAgents,
    primaryContext,
    supportingContexts,
    orchestrationMode:
      supportingAgents.length > 0
        ? "primary_plus_supporting"
        : "single_agent",
  };
}

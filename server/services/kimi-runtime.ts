import { AgentRunRepository } from "../repositories/agent-run-repository.js";
import { ConversationRepository } from "../repositories/conversation-repository.js";
import { KimiApiClient } from "../kimi/api-client.js";
import { KimiFormulaToolExecutor } from "../kimi/formula-tools.js";
import { loadKimiTurnContext } from "./kimi-context-loader.js";
import { KimiConversationTurnService } from "./kimi-conversation-turn-service.js";

export const kimiConversationTurnService = new KimiConversationTurnService({
  conversationRepository: new ConversationRepository(),
  agentRunRepository: new AgentRunRepository(),
  kimiClient: new KimiApiClient(),
  toolExecutor: new KimiFormulaToolExecutor(),
  contextLoader: loadKimiTurnContext,
});

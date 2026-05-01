import { ConversationRepository } from "../repositories/conversation-repository.js";
import { KimiApiClient } from "../kimi/api-client.js";
import { loadKimiTurnContext } from "./kimi-context-loader.js";
import { KimiConversationTurnService } from "./kimi-conversation-turn-service.js";

export const kimiConversationTurnService = new KimiConversationTurnService({
  conversationRepository: new ConversationRepository(),
  kimiClient: new KimiApiClient(),
  contextLoader: loadKimiTurnContext,
});

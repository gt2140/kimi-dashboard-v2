# Kimi Chat Minimal Backend Design

## Goal

Keep the current frontend exactly as-is and rebuild only the backend chat path so that:

- sending a message always reaches Kimi
- Kimi returns a response without helper orchestration
- user and assistant messages are persisted
- everything else can be reintroduced later from a stable base

## Product Boundaries

### Keep in the frontend

- `src/pages/KimiChat.tsx`
- `src/pages/KimiAgents.tsx`
- `src/pages/KimiAgentSettings.tsx`
- `src/pages/KimiVault.tsx`
- the current layout, message list, stages, buttons, and routes

### Simplify in the backend

- remove all agent-collaboration behavior from the active chat path
- ignore helper agents in the backend for now
- remove official Kimi tool orchestration from the active chat path
- remove local memory persistence from the active chat path
- remove vault retrieval from the active chat path for the first pass

The UI may still show those concepts, but the backend should not depend on them until the simple chat loop is stable.

## Target Architecture

The first working architecture is:

`KimiChat UI -> useKimiChatData -> /api/kimi/chat/stream -> MinimalKimiChatService -> Kimi API -> persist assistant message -> invalidate conversation queries`

## Backend Design

### HTTP layer

`server/http-app.ts` should expose only one live chat route:

- `POST /api/kimi/chat/stream`

The route should:

1. authenticate the request
2. validate `conversationId`, `content`, and `agentId`
3. call the minimal service
4. stream deltas and one final completion event

### Minimal Kimi chat service

The active service should do only these steps:

1. verify conversation ownership
2. save the user message
3. load a static system prompt from the selected frontend agent id
4. load a short recent-message window from the database
5. call Kimi with that prompt and recent messages
6. save the assistant message
7. emit the final completion

That is the full scope of the first-pass backend.

### Agent handling

The selected agent still matters, but only as a prompt selector.

For now, the backend should treat:

- `agentId` as a simple prompt key
- `calledAgentIds` as ignored input

There should be no supporting-agent fan-out, no planner, no synthesizer, and no helper execution graph.

### Memory handling

For the first pass:

- keep persisted chat history in `conversations` and `messages`
- do not use Aura-managed long-term memory
- do not depend on Kimi memory tools

This gives the cleanest possible baseline. Memory can be re-added after the minimal flow proves stable.

### Vault handling

Kimi Vault remains in the product, but it should not participate in the first-pass chat backend.

That means:

- upload, list, and preview stay alive
- chat prompt construction does not pull vault context yet

## File Strategy

### Keep

- `server/http-app.ts`
- `server/services/kimi-conversation-turn-service.ts`
- `server/services/kimi-runtime.ts`
- `server/kimi/api-client.ts`
- `server/trpc/chat-router.ts`
- `server/repositories/conversation-repository.ts`

### Rewrite to be minimal

- `server/services/kimi-conversation-turn-service.ts`
- `server/services/kimi-context-loader.ts`

### Remove from the active chat graph

- any helper-agent orchestration
- tool execution in the chat path
- vault retrieval in the chat path
- local memory persistence in the chat path

## Testing

The minimal rebuild must be protected by tests for:

- legacy `/api/chat/stream` staying removed
- Kimi chat route staying auth-protected
- Kimi chat service persisting the user and assistant messages
- Kimi chat service ignoring helper-agent backend behavior
- Kimi API client completing properly on streamed `[DONE]`

## Success Criteria

- frontend stays unchanged
- sending a message yields a persisted assistant response
- no backend helper or agent orchestration is required for a successful turn
- the chat pipeline is short enough to understand in one read

# Active Chat Runtime

This document is the source of truth for the production MVP chat path.

## Current MVP

The production chat is Venice-first and uses one authenticated JSON endpoint:

- `POST /api/chat/send`

The required request shape is intentionally small:

```json
{
  "conversationId": "existing-conversation-id",
  "content": "user message",
  "agentId": "generalist",
  "requestedModelName": "optional-venice-model-id"
}
```

When the user selects `Auto`, the frontend omits `requestedModelName` and the backend resolves the model from `VENICE_MODEL`, falling back to `zai-org-glm-5`.

## Production Checks

Use these checks in order:

1. `GET /api/health`
   Confirms auth, database, Supabase, and Venice environment categories are present.

2. `GET /api/chat/provider-check`
   Confirms the Venice key and default model can complete a minimal generation.

3. `POST /api/chat/diagnose-turn`
   Protected diagnostic for a real conversation turn. Use this only when the UI chat fails after health and provider checks pass.

4. `POST /api/chat/send`
   The real product path. It creates the user message, calls Venice, persists the assistant message, and returns the final assistant response.

## Active Components

- `server/chat/simple-chat-handler.ts`
- `server/chat/provider-check-handler.ts`
- `server/chat/diagnose-turn-handler.ts`
- `server/mvp/chat-turn-service.ts`
- `server/services/conversation-turn-runtime.ts`
- `server/services/model-gateway.ts`
- `server/trpc/chat-router.ts`
- `src/hooks/useKimiChatData.ts`
- `src/pages/KimiChat.tsx`
- `src/lib/model-catalog.ts`

Some file and route names still include `Kimi` because they are compatibility names from previous iterations. Do not treat those names as active provider requirements.

## Legacy Boundaries

These areas are not part of the production MVP execution path:

- native Kimi model execution
- OpenAI execution
- Aura medical runtime branching
- multi-agent orchestration inside a turn
- `/api/kimi/chat/stream`
- `/api/aura-medical/chat/stream`
- `/api/chat/stream` as the main smoke test

Keep legacy code isolated until a focused removal pass can prove no imports, tests, or deployed routes depend on it.

## Next Product Direction

The next safe sequence is:

1. Keep Venice as the only executable provider.
2. Expand the model picker from the live Venice catalog with curated fallback models.
3. Add vault context as a clearly bounded context contributor.
4. Evolve agents into Venice character profiles: prompt, allowed vault context, preferred model, and response style.
5. Remove or archive legacy provider code only after the Venice plus vault plus agent path has tests and production smoke coverage.

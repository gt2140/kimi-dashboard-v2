# AI Chat Backend Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up duplicated chat code, separate provider-specific Kimi behavior from the core turn runtime, and prepare the backend for Vercel AI-powered model execution and model selection.

**Architecture:** Work in phases that protect the current chat contract first, then consolidate frontend duplication, then extract a provider-neutral runtime and provider gateway. Keep compatibility aliases until tests prove the canonical path is stable.

**Tech Stack:** React 19, Vite, Hono, tRPC, TypeScript, Supabase Auth, Drizzle ORM, Postgres, Vitest, future Vercel AI SDK integration.

---

## Priority Map

`P0` protects behavior and creates a safe baseline.

`P1` removes duplication and creates provider-neutral boundaries.

`P2` migrates provider execution to Vercel AI and retires transitional naming.

---

### Task 1: Lock Down Canonical Chat Stream Behavior

**Priority:** P0

**Files:**
- Modify: `server/http-app.production.test.ts`
- Modify: `server/http-app.kimi-routes.test.ts`
- Modify: `server/trpc/chat-router.test.ts`
- Modify: `src/lib/chat-stream.test.ts`
- Modify: `src/hooks/kimi-chat-recovery.test.ts`

- [x] **Step 1: Add canonical stream contract test**

Add a test proving `/api/aura-medical/chat/stream` emits `ack`, at least one `stage`, streamed `text-delta`, and exactly one `message-complete` event for a successful turn.

Run: `vitest run server/http-app.production.test.ts`

Expected before implementation: FAIL if the current test harness cannot inject a streaming provider path.

- [x] **Step 2: Add explicit provider selection route test**

Add coverage that a request with `requestedProviderSlug: "venice"` and `requestedModelName` reaches the model gateway branch and returns metadata with `providerSlug`, `modelName`, `requestedProviderSlug`, and `requestedModelName`.

Run: `vitest run server/http-app.production.test.ts server/trpc/chat-router.test.ts`

Expected before implementation: FAIL if route-level injection/mocking is missing.

- [ ] **Step 3: Add persisted recovery integration coverage**

Extend recovery tests so a recoverable stream failure followed by a persisted assistant message produces a successful frontend completion.

Run: `vitest run src/hooks/kimi-chat-recovery.test.ts src/lib/chat-stream.test.ts`

Expected: PASS after the recovery helper behavior is covered.

- [ ] **Step 4: Keep Kimi aliases as compatibility smoke tests**

Update Kimi route tests so they assert alias behavior only: valid auth, valid body, and delegation to the same runtime contract. Avoid asserting Kimi-specific labels as the primary product behavior.

Run: `vitest run server/http-app.kimi-routes.test.ts api/kimi/routes.test.ts`

Expected: PASS.

### Task 2: Establish Shared Chat Contracts

**Priority:** P0

**Files:**
- Create: `contracts/chat-stream.ts`
- Create: `contracts/chat-models.ts`
- Create: `contracts/chat-metadata.ts`
- Modify: `src/lib/chat-stream.ts`
- Modify: `server/services/turn-stream-controller.ts`
- Modify: `server/trpc/chat-router.ts`
- Modify: `src/lib/model-catalog.ts`

- [x] **Step 1: Move stream event types to contracts**

Move the shared stream event type and encoder/parser types out of `src/lib/chat-stream.ts` into `contracts/chat-stream.ts`, then re-export from `src/lib/chat-stream.ts` to keep imports stable.

Run: `vitest run src/lib/chat-stream.test.ts server/services/turn-stream-controller.test.ts`

Expected: PASS.

- [x] **Step 2: Add model selection contract**

Create `ChatModelSelection` with `providerSlug: "auto" | "openai" | "venice" | "kimi"` and optional `modelName`. Use it in router schemas and frontend model catalog types where possible.

Run: `vitest run src/lib/model-catalog.test.ts server/trpc/chat-router.test.ts`

Expected: PASS.

- [x] **Step 3: Add assistant metadata contract**

Create `ChatAssistantMetadata` with stable provider-neutral fields and a `providerMetadata?: Record<string, unknown>` escape hatch.

Run: `vitest run server/services/kimi-conversation-turn-service.test.ts server/trpc/chat-router.test.ts`

Expected: PASS after existing metadata builders are adapted or compatibility-cast.

### Task 3: Remove Frontend Chat Hook Duplication

**Priority:** P1

**Files:**
- Create: `src/hooks/use-chat-conversation-state.ts`
- Create: `src/lib/chat-stream-client.ts`
- Modify: `src/hooks/useKimiChatData.ts`
- Modify: `src/hooks/useChatData.ts`
- Modify: `src/hooks/kimi-chat-mappers.ts`
- Modify: `src/pages/KimiChat.tsx`

- [ ] **Step 1: Extract shared conversation state hook**

Move URL `conversation` parsing, tRPC conversation queries, session mapping, message mapping, `ensureConversationId`, and invalidation helpers into `use-chat-conversation-state.ts`.

Run: `vitest run src/hooks/kimi-chat-recovery.test.ts src/lib/chat-stream.test.ts`

Expected: PASS.

- [ ] **Step 2: Extract shared stream client**

Move auth header construction, 401 retry, watchdog setup, NDJSON parsing, malformed stream handling, and request execution into `chat-stream-client.ts`.

Run: `vitest run src/lib/chat-stream.test.ts src/hooks/kimi-chat-recovery.test.ts`

Expected: PASS.

- [ ] **Step 3: Slim `useKimiChatData`**

Make `useKimiChatData` responsible only for wiring selected runtime options/model selection into the shared conversation and stream clients.

Run: `vitest run src/lib/chat-experience.test.ts src/lib/kimi-chat-stages.test.ts src/lib/kimi-chat-timeline.test.ts`

Expected: PASS.

- [x] **Step 4: Decide `useChatData` fate**

Search for live imports. If unused, mark it deprecated or remove it with tests. If used, convert it to the shared hook/client path.

Run: `npm run check`

Expected: PASS.

### Task 4: Extract Provider-Neutral Backend Runtime Boundary

**Priority:** P1

**Files:**
- Create: `server/services/conversation-turn-runtime.ts`
- Create: `server/services/chat-assistant-metadata.ts`
- Create: `server/services/ai-provider-gateway.ts`
- Modify: `server/services/kimi-conversation-turn-service.ts`
- Modify: `server/services/kimi-runtime.ts`
- Modify: `server/services/model-gateway.ts`
- Modify: `server/http-app.ts`
- Modify: `server/trpc/chat-router.ts`

- [x] **Step 1: Define `ConversationTurnRuntime` interface**

Create a neutral interface matching current `executeTurn` needs: user, conversation, agent IDs, runtime options, model selection, stream handlers, and normalized assistant message output.

Run: `vitest run server/services/kimi-conversation-turn-service.test.ts`

Expected: PASS with no behavior changes.

- [ ] **Step 2: Extract metadata builder**

Move assistant metadata construction out of `KimiConversationTurnService` into `chat-assistant-metadata.ts`, preserving existing fields through `providerMetadata`.

Run: `vitest run server/services/kimi-conversation-turn-service.test.ts server/trpc/chat-router.test.ts`

Expected: PASS.

- [x] **Step 3: Wrap current model gateway behind `AiProviderGateway`**

Create an interface that supports `generateText` and `streamText` through `ChatModelSelection`. Adapt current `ModelGatewayService` behind it.

Run: `vitest run server/services/model-gateway.test.ts server/services/kimi-conversation-turn-service.test.ts`

Expected: PASS.

- [ ] **Step 4: Rename runtime exports without changing routes**

Export a neutral runtime name such as `auraChatTurnRuntime` from `kimi-runtime.ts` or a new runtime module. Keep old exports as compatibility aliases during the transition.

Run: `vitest run server/http-app.production.test.ts server/trpc/chat-router.test.ts`

Expected: PASS.

### Task 5: Add Vercel AI Provider Adapter

**Priority:** P2

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/services/vercel-ai-provider.ts`
- Modify: `server/services/ai-provider-gateway.ts`
- Modify: `server/lib/env.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add Vercel AI SDK dependency**

Add the Vercel AI SDK package used by the chosen provider setup. Keep the dependency isolated to `server/services/vercel-ai-provider.ts`. Venice should use the OpenAI-compatible adapter with base URL `https://api.venice.ai/api/v1` and `.chat(modelId)`.

Run: `npm install ai`

Expected: dependency added and lockfile updated.

- [ ] **Step 2: Implement non-stream generation adapter**

Implement `generateText` through Vercel AI for a single Venice or OpenAI model selection path, preserving normalized `AiProviderResult`.

Run: `vitest run server/services/model-gateway.test.ts`

Expected: PASS after tests mock the adapter.

- [ ] **Step 3: Implement stream adapter**

Map Vercel AI streaming deltas into the existing `onTextDelta` callback so the HTTP NDJSON contract remains unchanged.

Run: `vitest run server/http-app.production.test.ts src/lib/chat-stream.test.ts`

Expected: PASS.

- [ ] **Step 4: Add provider capability checks**

Represent whether a model supports streaming, tools, reasoning, and large context. Use capability checks before enabling tool calls or special runtime options.

Run: `vitest run src/lib/model-catalog.test.ts server/services/model-gateway.test.ts`

Expected: PASS.

### Task 6: Retire Transitional Kimi/Aura Naming

**Priority:** P2

**Files:**
- Modify: `src/hooks/useKimiChatData.ts`
- Modify: `src/pages/KimiChat.tsx`
- Modify: `src/lib/kimi-chat-stages.ts`
- Modify: `src/lib/kimi-chat-timeline.ts`
- Modify: `server/services/kimi-runtime.ts`
- Modify: `server/services/kimi-conversation-turn-service.ts`
- Modify: `server/http-app.ts`
- Modify: `README.md`

- [ ] **Step 1: Rename frontend chat hook path**

Introduce `useAuraChatData` or `useChatRuntimeData` and keep `useKimiChatData` as a temporary re-export if needed.

Run: `npm run check`

Expected: PASS.

- [ ] **Step 2: Rename UI stage labels**

Replace user-facing Kimi labels with provider-neutral chat/Aura labels, except where the provider truly is Kimi.

Run: `vitest run src/lib/kimi-chat-stages.test.ts src/lib/kimi-chat-timeline.test.ts`

Expected: tests updated to provider-neutral naming and PASS.

- [ ] **Step 3: Mark legacy routes**

Document `/api/kimi/chat/stream` as a compatibility alias. If no external dependency exists, plan a later removal commit.

Run: `vitest run server/http-app.kimi-routes.test.ts`

Expected: PASS.

### Task 7: Full Verification

**Priority:** P0/P1/P2 completion gate

**Files:**
- No new files unless failures reveal missing focused tests.

- [ ] **Step 1: Run backend chat tests**

Run: `vitest run server/services/model-gateway.test.ts server/services/kimi-conversation-turn-service.test.ts server/services/conversation-turn-service.test.ts server/trpc/chat-router.test.ts server/http-app.production.test.ts server/http-app.kimi-routes.test.ts`

Expected: PASS.

- [ ] **Step 2: Run frontend chat tests**

Run: `vitest run src/lib/chat-stream.test.ts src/hooks/kimi-chat-recovery.test.ts src/lib/model-catalog.test.ts src/lib/kimi-chat-stages.test.ts src/lib/kimi-chat-timeline.test.ts`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `npm test`

Expected: PASS or documented environment-only failures.

---

## Execution Notes

- Start with Task 1 before any runtime extraction. The current behavior must be pinned before names move.
- Keep compatibility aliases until the canonical route is covered by tests and the frontend uses it exclusively.
- Do not migrate Kimi tools in the same commit as provider execution. Tools are a separate risk area.
- Prefer small commits by task so regressions can be isolated quickly.

# Venice-First Chat Backend Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a backend-only MVP path where authenticated generalist chat turns run through one Venice-first runtime and one canonical streaming endpoint, without touching the current frontend flow yet.

**Architecture:** Keep the existing persistence, auth, tRPC CRUD, and NDJSON stream contract, but replace the runtime path behind them with a small Venice-only turn executor. Treat `/api/chat/stream` and `chatRouter.sendMessage` as thin adapters over the same backend runtime. Leave frontend files unchanged in this stage, even if some naming is still Kimi-branded there.

**Tech Stack:** Hono, tRPC, TypeScript, Drizzle ORM, Postgres, Supabase Auth, Vitest, Venice HTTP APIs.

---

## Scope Guardrails

- Backend-only stage. Do not rename or rewrite frontend files in `app/src` yet.
- Keep conversation CRUD and auth behavior intact.
- Keep the NDJSON stream event contract intact: `ack`, `stage`, `text-delta`, `message-complete`, `error`.
- Generalist is the only supported execution path for this stage, even if `agentId` remains in storage and transport.
- Vault, medical mode, helper agents, and OpenAI/Kimi execution are out of the runtime path for this stage.

## File Map

**Primary code paths to modify**

- `app/server/services/conversation-turn-runtime.ts`
- `app/server/services/kimi-runtime.ts`
- `app/server/services/model-gateway.ts`
- `app/server/services/model-gateway.test.ts`
- `app/server/trpc/chat-router.ts`
- `app/server/trpc/chat-router.test.ts`
- `app/server/http-app.ts`
- `app/server/http-app.kimi-routes.test.ts`
- `app/api/kimi/chat/stream.ts`
- `app/api/aura-medical/chat/stream.ts`
- `app/README.md`
- `app/.env.example`

**Existing code to keep but decouple from the MVP path**

- `app/server/services/aura-medical-runtime.ts`
- `app/server/services/kimi-context-loader.ts`
- `app/server/services/kimi-memory*.ts`
- `app/server/services/vault-v2*.ts`
- `app/server/services/conversation-turn-service.ts`
- `app/server/services/chat-reply-builder.ts`

---

### Task 1: Lock the backend scope with failing and adjusted tests

**Files:**

- Modify: `app/server/trpc/chat-router.test.ts`
- Modify: `app/server/http-app.kimi-routes.test.ts`
- Modify: `app/server/services/model-gateway.test.ts`
- Create or Modify: `app/server/services/conversation-turn-runtime.test.ts` if absent, otherwise extend the runtime coverage file that owns the new Venice runtime tests

- [x] **Step 1: Rewrite router input expectations around the backend-only MVP**

Cover these invariants:

- `requestedModelName` is accepted
- `requestedProviderSlug` is no longer part of the public runtime input
- `calledAgentIds`, `runtimeVersion`, `medicalMode`, and `policyLevel` are not required for the Stage 1 backend path

Run: `npm --prefix app run test -- server/trpc/chat-router.test.ts`

Expected before implementation: FAIL on stale Kimi/Aura Medical expectations.

- [x] **Step 2: Rewrite route coverage around one canonical endpoint**

Keep `/api/chat/stream` as the production route under test.
Remove expectations that `/api/kimi/chat/stream` and `/api/aura-medical/chat/stream` are valid runtime entrypoints.

Run: `npm --prefix app run test -- server/http-app.kimi-routes.test.ts`

Expected before implementation: FAIL because the test still expects legacy aliases.

- [x] **Step 3: Add Venice model catalog fallback coverage**

Cover:

- Venice catalog mapping
- curated fallback when live catalog fails
- `Auto` resolving to `VENICE_MODEL`

Run: `npm --prefix app run test -- server/services/model-gateway.test.ts`

Expected before implementation: FAIL if fallback catalog behavior is not implemented yet.

### Task 2: Replace the runtime contract with a small Venice-first turn executor

**Files:**

- Modify: `app/server/services/conversation-turn-runtime.ts`
- Modify: `app/server/services/kimi-runtime.ts`
- Review: `app/server/repositories/conversation-repository.ts`
- Review: `app/server/repositories/agent-run-repository.ts`

- [x] **Step 1: Shrink the `ConversationTurnRuntimeInput` contract**

The runtime input for Stage 1 should only need:

- `userId`
- `conversationId`
- `content`
- `agentId`
- `requestedModelName?`
- `stream`
- `onStage?`
- `onTextDelta?`

Remove backend runtime dependence on:

- `calledAgentIds`
- `runtimeOptions`
- `modelSelection`

Run: `npm --prefix app run test -- server/trpc/chat-router.test.ts`

Expected before implementation: FAIL on old type coupling.

- [x] **Step 2: Implement the Venice-first runtime in `kimi-runtime.ts` or a renamed neutral export**

The runtime flow must be:

1. require conversation ownership
2. persist user message
3. load lightweight context
4. stream or generate Venice output
5. persist assistant message
6. finalize run metadata

Keep a compatibility export only if needed for imports, but the behavior itself should no longer be Kimi-specific.

- [x] **Step 3: Define the lightweight context policy**

The runtime should assemble context from:

- active generalist prompt
- last 6 conversation messages
- existing conversation summary if present

It must not load:

- vault context
- long-term Kimi memory
- tool execution plans
- research evidence
- multi-agent support

- [x] **Step 4: Normalize assistant metadata for Stage 1**

Persist reduced metadata only:

- `engine: "aura-chat-v1"`
- `providerSlug: "venice"`
- `modelName`
- `requestedModelName`
- `inputTokens?`
- `outputTokens?`

Run: `npm --prefix app run test -- server/services/conversation-turn-runtime.test.ts`

Expected after implementation: PASS.

### Task 3: Simplify model execution and model listing to Venice only

**Files:**

- Modify: `app/server/services/model-gateway.ts`
- Modify: `app/server/services/model-gateway.test.ts`

- [x] **Step 1: Remove OpenAI execution branches from the active chat path**

`ModelGatewayService` should become the only provider bridge for Stage 1, but it should only execute Venice generation, Venice streaming, and Venice model listing.

Keep helper code only if removing it immediately would create unrelated churn; otherwise delete dead provider branches.

- [x] **Step 2: Keep `Auto` as a local fallback option**

`Auto` should resolve to `env.veniceModel`.
This is transport and catalog behavior only, not a second provider.

- [x] **Step 3: Add curated Venice fallback catalog**

When the Venice catalog request fails, return a local curated list that keeps the picker functional.
At minimum, include the configured default model and any other known-safe text models the current UI expects.

- [x] **Step 4: Keep error handling clean for stream consumers**

Provider failures should surface as sanitized errors suitable for NDJSON `error` events and route consumers.

Run: `npm --prefix app run test -- server/services/model-gateway.test.ts`

Expected after implementation: PASS.

### Task 4: Collapse HTTP streaming to `/api/chat/stream`

**Files:**

- Modify: `app/server/http-app.ts`
- Modify: `app/api/chat/stream.ts` only if import wiring changes
- Delete or stop routing through: `app/api/kimi/chat/stream.ts`
- Delete or stop routing through: `app/api/aura-medical/chat/stream.ts`
- Modify: `app/server/http-app.kimi-routes.test.ts`

- [x] **Step 1: Remove route branching by legacy path**

`http-app.ts` should expose one canonical handler for `POST /api/chat/stream`.
Delete the special input builder and route-dependent messaging that exists only to distinguish chat, kimi, and aura-medical aliases.

- [x] **Step 2: Keep request validation minimal and explicit**

Validate:

- `conversationId`
- `content`
- `agentId`
- `requestedModelName?`

Return:

- `400` for invalid body
- `401` for unauthenticated requests

- [x] **Step 3: Keep the stream contract unchanged**

Route output order must remain:

- `ack`
- one or more `stage`
- zero or more `text-delta`
- `message-complete`

Failures must emit `error`.

- [x] **Step 4: Pass the selected Venice model name through unchanged**

The route must pass `requestedModelName` into the runtime without provider branching.

Run: `npm --prefix app run test -- server/http-app.kimi-routes.test.ts`

Expected after implementation: PASS.

### Task 5: Make tRPC chat mutations use the same backend runtime

**Files:**

- Modify: `app/server/trpc/chat-router.ts`
- Modify: `app/server/trpc/chat-router.test.ts`

- [x] **Step 1: Reduce `chatSendMessageInputSchema` to MVP fields**

Keep:

- `conversationId`
- `content`
- `agentId`
- `requestedModelName?`

Do not require or actively use:

- `calledAgentIds`
- `runtimeVersion`
- `medicalMode`
- `policyLevel`
- `requestedProviderSlug`

- [x] **Step 2: Keep conversation CRUD untouched**

Do not widen scope into `listConversations`, `getConversation`, `createConversation`, or `deleteConversation` except where type coupling forces small updates.

- [x] **Step 3: Route `sendMessage` through the new Venice-first runtime**

`sendChatMessage` should call the same runtime used by `/api/chat/stream`, with the only difference being whether streaming callbacks are attached.

- [x] **Step 4: Keep `listAvailableModels` backend-compatible with the current UI**

Return:

- one local `Auto` option
- live Venice text models
- curated fallback Venice models when catalog fetch fails

Run: `npm --prefix app run test -- server/trpc/chat-router.test.ts`

Expected after implementation: PASS.

### Task 6: Update docs and env to match the backend-only MVP

**Files:**

- Modify: `app/README.md`
- Modify: `app/.env.example`

- [x] **Step 1: Rewrite the MVP backend description**

Document that chat now depends on:

- Supabase auth/session
- conversation persistence
- Venice as the only chat provider

Do not present Kimi/OpenAI as active chat requirements for this stage.

- [x] **Step 2: Trim environment guidance**

Keep:

- `VENICE_API_KEY`
- `VENICE_INFERENCE_KEY` if still supported as an alias
- `VENICE_MODEL`

Remove provider variables from the required chat path documentation if they are no longer needed by the backend MVP.

- [x] **Step 3: Add one backend smoke verification note**

Document one manual authenticated chat check with an explicit Venice model selection.

Run: `npm --prefix app run check`

Expected after implementation: PASS.

### Task 7: Verify the backend stage end-to-end

**Files:**

- No new code unless regressions are found

- [x] **Step 1: Run focused backend tests**

Run:

```bash
npm --prefix app run test -- server/services/conversation-turn-runtime.test.ts server/services/model-gateway.test.ts server/trpc/chat-router.test.ts server/http-app.kimi-routes.test.ts
```

Expected: PASS.

- [x] **Step 2: Run the TypeScript compile check**

Run:

```bash
npm --prefix app run check
```

Expected: PASS.

- [ ] **Step 3: Run one manual authenticated chat smoke test**

Verify:

- `/api/chat/stream` authenticates correctly
- the selected Venice model reaches the runtime
- user and assistant messages persist in order
- assistant metadata stores `engine`, `providerSlug`, `modelName`, and usage when present

- [ ] **Step 4: Commit**

```bash
git add app/server/services/conversation-turn-runtime.ts app/server/services/kimi-runtime.ts app/server/services/model-gateway.ts app/server/services/model-gateway.test.ts app/server/trpc/chat-router.ts app/server/trpc/chat-router.test.ts app/server/http-app.ts app/server/http-app.kimi-routes.test.ts app/api/chat/stream.ts app/api/kimi/chat/stream.ts app/api/aura-medical/chat/stream.ts app/README.md app/.env.example app/docs/superpowers/plans/2026-05-14-venice-first-chat-backend-stage-1.md
git commit -m "refactor: ship venice-first chat backend stage 1"
```

## Out of Scope After Stage 1

- Frontend renaming from Kimi to neutral Aura chat naming
- frontend model picker cleanup
- helper-agent UI removal
- vault-aware chat context
- medical/runtime policy branches
- research tooling
- multi-agent orchestration
- rebuilding secondary-agent backend flows

Those are explicitly deferred until the Venice-first backend path is stable and working.

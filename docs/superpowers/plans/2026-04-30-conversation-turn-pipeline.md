# Conversation Turn Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the production-critical conversational turn pipeline so every accepted turn persists early, runs through a clear orchestration path, and terminates the stream deterministically.

**Architecture:** Introduce a dedicated `ConversationTurnService` plus thin repository and stream-control helpers. Keep the current frontend event contract unchanged while moving orchestration and persistence out of the monolithic `chat-router.ts` path.

**Tech Stack:** Hono, tRPC, TypeScript, Drizzle ORM, Postgres, Vitest, existing OpenAI Responses integration.

---

### Task 1: Lock down pipeline invariants with failing tests

**Files:**
- Create: `server/services/conversation-turn-service.test.ts`
- Review: `server/trpc/chat-router.test.ts`
- Review: `server/services/model-gateway.test.ts`

- [ ] **Step 1: Write the failing service-level tests**

Add tests that prove:
- the user message is persisted before reply generation starts
- the primary run is created before reply generation starts
- provider/build failures finalize the run instead of leaving the pipeline ambiguous

- [ ] **Step 2: Run only the new pipeline test file**

Run: `vitest run server/services/conversation-turn-service.test.ts`
Expected: FAIL because `ConversationTurnService` does not exist yet.

- [ ] **Step 3: Keep the existing focused regressions ready**

Reference:
- `server/trpc/chat-router.test.ts`
- `server/services/model-gateway.test.ts`

These should continue to guard streaming and provider behavior after the refactor.

### Task 2: Introduce repositories for early persistence

**Files:**
- Create: `server/repositories/conversation-repository.ts`
- Create: `server/repositories/agent-run-repository.ts`
- Modify: `server/trpc/chat-router.ts`

- [ ] **Step 1: Add a `ConversationRepository`**

Responsibilities:
- require ownership
- create user message immediately
- create assistant message
- update conversation metadata

- [ ] **Step 2: Add an `AgentRunRepository`**

Responsibilities:
- create primary run in `queued`
- mark primary run `running`
- finalize primary run as `completed` or `failed`
- persist supporting runs

- [ ] **Step 3: Move raw persistence helpers out of `chat-router.ts`**

`chat-router.ts` should stop owning low-level message/run insert logic directly.

### Task 3: Add deterministic stream control

**Files:**
- Create: `server/services/turn-stream-controller.ts`
- Create: `server/services/turn-stream-controller.test.ts`
- Modify: `server/http-app.ts`

- [ ] **Step 1: Write a failing stream controller test**

Cover:
- stage emission
- delta emission
- exactly one terminal event
- no duplicate terminal completion

- [ ] **Step 2: Run the stream controller test**

Run: `vitest run server/services/turn-stream-controller.test.ts`
Expected: FAIL because the controller does not exist yet.

- [ ] **Step 3: Implement `TurnStreamController`**

It must:
- serialize outgoing NDJSON event writes
- reject duplicate terminal transitions
- close cleanly after `message-complete` or `error`

- [ ] **Step 4: Route `/api/chat/stream` through the controller**

`http-app.ts` should become a thin adapter that delegates stream lifecycle to the controller and turn service.

### Task 4: Introduce `ConversationTurnService`

**Files:**
- Create: `server/services/conversation-turn-service.ts`
- Modify: `server/http-app.ts`
- Modify: `server/trpc/chat-router.ts`

- [ ] **Step 1: Create the service skeleton**

Responsibilities:
- validate ownership
- sync participants
- persist user message
- create and start primary run
- call reply builder
- persist assistant message
- finalize run

- [ ] **Step 2: Add explicit failure handling**

On any failure after the run exists:
- finalize run as failed
- preserve operational reason when available
- never leave the turn without a terminal outcome

- [ ] **Step 3: Make the streamed endpoint call the new service**

The HTTP route should use the service as the single execution path.

- [ ] **Step 4: Make the tRPC mutation reuse the same orchestration path**

Non-stream and stream turns should share the same core pipeline.

### Task 5: Extract reply building from router orchestration

**Files:**
- Create: `server/services/chat-reply-builder.ts`
- Modify: `server/trpc/chat-router.ts`
- Modify: `server/services/conversation-turn-service.ts`

- [ ] **Step 1: Move `buildAssistantReply` and related helpers out of `chat-router.ts`**

The router should stop containing the heavy reply-building flow.

- [ ] **Step 2: Keep the existing reply behavior stable**

Do not rewrite specialist consultation or prompt semantics in this phase.
Only relocate and isolate them.

- [ ] **Step 3: Leave `chat-router.ts` as a thin adapter**

It should mainly expose schemas, list/get/create/delete routes, and call the new service for send-message behavior.

### Task 6: Verify regressions and compile

**Files:**
- No new code unless regressions are found

- [ ] **Step 1: Run focused backend tests**

Run: `vitest run server/services/conversation-turn-service.test.ts server/services/turn-stream-controller.test.ts server/trpc/chat-router.test.ts server/services/model-gateway.test.ts server/services/chat-fallback.test.ts`
Expected: PASS

- [ ] **Step 2: Run TypeScript build**

Run: `tsc -b`
Expected: PASS

- [ ] **Step 3: Run one production-backed chat turn manually if needed**

Use the local backend path only as a verification aid, not as a committed tool.
Confirm:
- user message persists early
- a run record exists
- terminal outcome is persisted

- [ ] **Step 4: Commit**

```bash
git add server/http-app.ts server/trpc/chat-router.ts server/repositories server/services docs/superpowers/plans/2026-04-30-conversation-turn-pipeline.md
git commit -m "Refactor conversation turn pipeline"
```

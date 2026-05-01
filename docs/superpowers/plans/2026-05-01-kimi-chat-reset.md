# Kimi Chat Minimal Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the current frontend intact while replacing the backend chat path with a minimal persisted Kimi-only flow that always sends and receives messages.

**Architecture:** The frontend keeps using `useKimiChatData` and the Kimi pages, while the backend chat route is reduced to one simple service: save the user message, build a static prompt from the chosen agent id, call Kimi, save the assistant reply, and stream it back. Helper agents, tool orchestration, vault retrieval, and memory layers are all removed from the active chat path.

**Tech Stack:** React 19, Vite, Hono, tRPC, Drizzle ORM, Vitest, Kimi API

---

## File Structure

- Modify: `server/http-app.ts`
- Modify: `server/http-app.kimi-routes.test.ts`
- Modify: `server/kimi/api-client.ts`
- Modify: `server/kimi/api-client.test.ts`
- Modify: `server/services/kimi-conversation-turn-service.ts`
- Modify: `server/services/kimi-conversation-turn-service.test.ts`
- Modify: `server/services/kimi-context-loader.ts`
- Modify: `server/services/kimi-runtime.ts`
- Modify: `server/trpc/chat-router.ts`
- Modify: `server/repositories/conversation-repository.ts`
- Delete: any remaining backend chat orchestration files not needed by the minimal path

### Task 1: Lock the public chat surface to Kimi only

**Files:**
- Modify: `server/http-app.kimi-routes.test.ts`
- Modify: `server/http-app.ts`
- Delete: `api/chat/stream.ts`

- [ ] **Step 1: Write the failing route test**

Add a test that requests `POST /api/chat/stream` and expects `404`.

- [ ] **Step 2: Run the focused route test to verify it fails**

Run: `npm test -- server/http-app.kimi-routes.test.ts`
Expected: FAIL because `/api/chat/stream` still resolves to the legacy handler.

- [ ] **Step 3: Remove the legacy route and handler**

Delete the old route from `server/http-app.ts` and delete `api/chat/stream.ts`.

- [ ] **Step 4: Run the focused route test to verify it passes**

Run: `npm test -- server/http-app.kimi-routes.test.ts`
Expected: PASS with Kimi routes still protected and legacy chat route returning `404`.

### Task 2: Remove all non-essential backend behavior from the active turn path

**Files:**
- Modify: `server/services/kimi-conversation-turn-service.test.ts`
- Modify: `server/services/kimi-conversation-turn-service.ts`

- [ ] **Step 1: Write the failing behavior tests**

Add or adapt tests to prove the service can complete a turn without:

- helper-agent execution
- Kimi official tools
- Aura-local memory persistence
- vault context retrieval

- [ ] **Step 2: Run the focused service test to verify it fails**

Run: `npm test -- server/services/kimi-conversation-turn-service.test.ts`
Expected: FAIL because the current implementation still performs extra backend work.

- [ ] **Step 3: Rewrite the Kimi turn service to the minimal loop**

Keep only:

- ownership check
- user message persistence
- static prompt selection
- recent message loading
- Kimi call
- assistant message persistence
- final stream completion

- [ ] **Step 4: Run the focused service test to verify it passes**

Run: `npm test -- server/services/kimi-conversation-turn-service.test.ts`
Expected: PASS with the new minimal behavior.

### Task 3: Slim the Kimi context loader to static prompt plus recent history

**Files:**
- Modify: `server/services/kimi-context-loader.ts`

- [ ] **Step 1: Remove database-backed agent context from the active chat path**

Stop loading system prompt overrides, training notes, tools, memory, and vault retrieval for the first pass.

- [ ] **Step 2: Keep only minimal context inputs**

Retain only:

- static prompt derived from the selected agent id
- recent messages
- prompt cache key
- safety identifier

- [ ] **Step 3: Run the Kimi service tests**

Run: `npm test -- server/services/kimi-conversation-turn-service.test.ts`
Expected: PASS with the slimmer context contract.

### Task 4: Simplify the chat router and runtime to persistence-only responsibilities

**Files:**
- Modify: `server/trpc/chat-router.ts`
- Delete: legacy server chat pipeline files when unused

- [ ] **Step 1: Keep only read/write conversation responsibilities in tRPC**

The live send path should remain the Kimi HTTP stream route.

- [ ] **Step 2: Delete legacy files that become unreferenced**

Remove any remaining backend chat files that are no longer referenced by the minimal path.

- [ ] **Step 3: Run the related server tests**

Run: `npm test -- server/http-app.kimi-routes.test.ts server/services/kimi-conversation-turn-service.test.ts`
Expected: PASS.

### Task 5: Final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-05-01-kimi-chat-reset-design.md`
- Modify: `docs/superpowers/plans/2026-05-01-kimi-chat-reset.md`

- [ ] **Step 1: Run focused automated checks**

Run: `npm test -- server/http-app.kimi-routes.test.ts server/services/kimi-conversation-turn-service.test.ts server/kimi/api-client.test.ts api/kimi/routes.test.ts`
Expected: PASS.

- [ ] **Step 2: Run repository type-check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Update the docs if any file list changed during implementation**

Keep spec and plan aligned with the actual simplified graph.

# Chat/Auth Rescue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the dashboard to a functional state by rebuilding the chat, agents API, and auth/session infrastructure around a simpler and more reliable execution path.

**Architecture:** Stabilize the existing repo instead of doing a blind rollback. First lock down regression tests around abort handling, session sync, and stream behavior. Then simplify the shared auth/session path, harden the chat stream boundary, and improve user-facing degraded-mode and retry behavior without changing the overall product surface.

**Tech Stack:** React 19, Vite, Hono, tRPC, TypeScript, Supabase Auth, Drizzle ORM, Postgres, Vitest.

---

### Task 1: Lock down the regressions with failing tests

**Files:**
- Modify: `server/services/async-guard.test.ts`
- Modify: `src/lib/chat-stream.test.ts`
- Modify: `src/lib/request-auth.test.ts`
- Modify: `server/trpc/chat-router.test.ts`

- [ ] **Step 1: Add a regression test for non-destructive success paths**

Prove that `withAbortableTimeout()` does not abort the underlying signal after a successful operation has already completed.

- [ ] **Step 2: Add a regression test for readable timeout failures**

Prove that aborted timeout paths surface stable, user-readable errors instead of raw `AbortError`/`This operation was aborted`.

- [ ] **Step 3: Add a regression test for authenticated stream fallback**

Prove that chat streaming can fall back cleanly and still emit a deterministic completion payload when the stream endpoint cannot complete normally.

- [ ] **Step 4: Run focused tests to verify RED**

Run: `vitest run server/services/async-guard.test.ts src/lib/chat-stream.test.ts src/lib/request-auth.test.ts server/trpc/chat-router.test.ts`
Expected: at least one new regression test fails before implementation.

### Task 2: Rebuild timeout and abort infrastructure

**Files:**
- Modify: `server/services/async-guard.ts`
- Modify: `server/services/model-gateway.ts`
- Modify: `server/trpc/auth.ts`
- Modify: `server/lib/http.ts`

- [ ] **Step 1: Fix `withAbortableTimeout()` semantics**

The helper must abort only on timeout or caller cancellation, not on successful completion.

- [ ] **Step 2: Normalize provider timeout errors**

Convert low-level abort failures into explicit timeout/runtime errors that downstream layers can classify.

- [ ] **Step 3: Align auth token validation timeouts**

Keep the timeout protection, but ensure auth failures distinguish invalid token vs slow provider vs temporary backend unavailability.

### Task 3: Simplify and harden chat/agents API execution

**Files:**
- Modify: `server/http-app.ts`
- Modify: `server/services/chat-reply-builder.ts`
- Modify: `server/services/conversation-turn-service.ts`
- Modify: `server/services/turn-stream-controller.ts`
- Modify: `src/hooks/useChatData.ts`

- [ ] **Step 1: Reduce stream fragility at the boundary**

Ensure exactly one terminal outcome reaches the client: streamed completion, deterministic fallback completion, or explicit error.

- [ ] **Step 2: Keep the turn pipeline functional without specialist fan-out**

If supporting-agent orchestration is slow or unavailable, the primary path must still complete instead of degrading the whole turn.

- [ ] **Step 3: Harden the frontend stream consumer**

Ensure partial text, degraded-mode completions, and retries do not leave the composer or pending state stuck.

### Task 4: Rebuild auth/session UX around backend readiness

**Files:**
- Modify: `src/providers/trpc.tsx`
- Modify: `src/hooks/useAuth.ts`
- Modify: `src/pages/AuthCallback.tsx`
- Modify: `src/pages/Login.tsx`
- Modify: `src/lib/app-errors.ts`

- [ ] **Step 1: Make backend-session sync idempotent and understandable**

Avoid ambiguous half-authenticated states and preserve clear error categories.

- [ ] **Step 2: Improve callback/login recovery**

If OAuth finishes but backend sync fails, show a specific recovery path instead of a generic broken state.

- [ ] **Step 3: Improve runtime error mapping**

Map auth timeout, auth sync failure, stream interruption, and degraded chat mode into actionable UI messages.

### Task 5: Verify the rescue build

**Files:**
- No new files unless regressions force small helpers

- [ ] **Step 1: Run focused regression tests**

Run: `vitest run server/services/async-guard.test.ts src/lib/chat-stream.test.ts src/lib/request-auth.test.ts server/trpc/chat-router.test.ts`
Expected: PASS

- [ ] **Step 2: Run broader chat/auth coverage**

Run: `vitest run server/services/conversation-turn-service.test.ts server/services/turn-stream-controller.test.ts server/services/model-gateway.test.ts src/lib/app-errors.test.ts src/lib/request-auth.test.ts src/pages/Login.test.ts`
Expected: PASS

- [ ] **Step 3: Run TypeScript build**

Run: `tsc -b`
Expected: PASS

- [ ] **Step 4: Summarize remaining risk**

Call out anything still blocked by live environment, Supabase config, or production-only provider behavior.

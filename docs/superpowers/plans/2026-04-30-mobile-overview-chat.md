# Mobile Overview And Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the authenticated mobile app by curating the overview agent list, fixing the chat composer position, and resolving the chatbot stream hang.

**Architecture:** Keep desktop behavior largely intact while introducing mobile-specific rendering in `Dashboard.tsx` and `Chat.tsx`. Fix the chatbot at the stream parser boundary in `server/services/model-gateway.ts` so the UI receives completed assistant events reliably.

**Tech Stack:** React 19, React Router, Zustand, tRPC, Hono, Vitest, Tailwind, OpenAI Responses API.

---

### Task 1: Fix OpenAI stream parsing

**Files:**
- Modify: `server/services/model-gateway.ts`
- Test: `server/services/model-gateway.test.ts`

- [ ] Add a failing test that covers CRLF-delimited SSE event frames.
- [ ] Run only the model gateway test file and confirm the new test fails for the current parser.
- [ ] Update the parser to normalize line endings before splitting event frames.
- [ ] Re-run the model gateway tests and confirm they pass.

### Task 2: Rework mobile overview agents

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Reuse: `src/hooks/useAgentCatalog.ts`

- [ ] Introduce mobile-aware favorites rendering using the persisted favorite agent catalog.
- [ ] Limit the mobile cards to three favorites and preserve the current desktop built-in grid.
- [ ] Add a clear marketplace CTA that routes to `/agents`.
- [ ] Verify the generalist remains available as a favorite anchor.

### Task 3: Rework mobile chat shell

**Files:**
- Modify: `src/pages/Chat.tsx`
- Review: `src/components/layout/DashboardLayout.tsx`

- [ ] Restructure the chat page so the messages area is the primary scroll container.
- [ ] Make the composer sticky at the bottom with stronger visual separation.
- [ ] Compress the empty state and shortcuts on mobile so the composer remains visible on first load.
- [ ] Keep desktop behavior visually aligned with the current experience.

### Task 4: Verify end-to-end chat fallback behavior

**Files:**
- Modify if needed: `src/hooks/useChatData.ts`
- Review: `src/lib/chat-stream.ts`
- Review: `server/trpc/chat-router.ts`

- [ ] Confirm the frontend still handles `stage`, `text-delta`, and `message-complete` events after the parser fix.
- [ ] Verify that the fallback path still materializes an assistant message if live generation fails.
- [ ] Run the focused chat stream tests after implementation.

### Task 5: Final verification

**Files:**
- No additional code required unless regressions are found.

- [ ] Run the focused test set for model gateway and chat stream behavior.
- [ ] Review the modified mobile UI classes for obvious overflow or scroll regressions.
- [ ] Summarize residual risks, especially around device keyboard behavior and OpenAI provider variability.

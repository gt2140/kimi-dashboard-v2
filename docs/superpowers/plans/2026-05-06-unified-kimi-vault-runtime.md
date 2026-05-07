# Unified Kimi Vault Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all chat through `KimiConversationTurnService` and make vault ingestion expose explicit lifecycle state plus per-file traces so only usable files reach model context.

**Architecture:** Keep the existing Kimi/Aura Medical runtime as the only execution path, convert legacy chat entrypoints into aliases over that runtime, and move vault state derivation behind a dedicated lifecycle helper. Persist ingestion telemetry in a new table so the UI and loaders can distinguish “uploaded”, “indexed”, and “context-eligible” without guessing from mixed legacy flags.

**Tech Stack:** React, Hono, tRPC, Drizzle ORM, Postgres/Supabase, Vitest, TypeScript

---

### Task 1: Define vault lifecycle state and telemetry storage

**Files:**
- Modify: `db/schema.ts`
- Modify: `db/relations.ts`
- Modify: `supabase/init.sql`
- Test: `server/services/vault-lifecycle.test.ts`

- [ ] Add schema for vault ingestion telemetry and explicit lifecycle fields.
- [ ] Add lifecycle helper tests before implementation.
- [ ] Implement lifecycle helper to derive `uploaded`, `extracted`, `indexed`, and `context-eligible`.

### Task 2: Move ingestion service onto explicit lifecycle transitions

**Files:**
- Create: `server/services/vault-lifecycle.ts`
- Modify: `server/services/kimi-vault-ingestion.ts`
- Modify: `server/services/kimi-vault-ingestion.test.ts`

- [ ] Write failing tests for lifecycle transitions and trace emission.
- [ ] Update ingestion repository methods to persist lifecycle and append trace rows.
- [ ] Keep legacy fields populated for compatibility while new fields become canonical.

### Task 3: Restrict context loading to context-eligible vault files

**Files:**
- Modify: `server/services/kimi-context-loader.ts`
- Modify: `server/services/context-assembler.ts`
- Modify: `server/trpc/vault-router.ts`
- Test: `server/services/kimi-context-loader.test.ts`

- [ ] Add failing tests for eligibility filtering.
- [ ] Update loaders and vault list mapping to use canonical lifecycle fields.
- [ ] Ensure metadata reports only files/chunks actually used by the model.

### Task 4: Force all chat entrypoints onto the Kimi runtime

**Files:**
- Modify: `server/http-app.ts`
- Modify: `src/lib/aura-runtime.ts`
- Modify: `src/lib/aura-runtime.test.ts`
- Modify: `src/pages/KimiChat.tsx`
- Modify: `src/hooks/useChatData.ts`

- [ ] Add failing tests for route alias behavior where useful.
- [ ] Route `/api/chat/stream` and `/api/kimi/chat/stream` through `KimiConversationTurnService`.
- [ ] Remove the Classic toggle from the main chat UI and make client runtime resolution deterministic.

### Task 5: Verify and document the migration surface

**Files:**
- Modify: `README.md`
- Modify: `src/pages/KimiVault.tsx`

- [ ] Update UI copy to reflect explicit vault lifecycle.
- [ ] Run targeted Vitest coverage and `tsc -b`.
- [ ] Summarize compatibility behavior and remaining cleanup items.

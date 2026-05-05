# Aura Medical Runtime V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an opt-in Aura medical runtime that coexists with the current chat flow, adds `personal-health` and `research` modes, and persists runtime/evidence metadata.

**Architecture:** Reuse the current chat shell and Kimi turn pipeline, but add a new runtime contract path, a medical context wrapper, and frontend runtime controls. Keep the NDJSON stream contract unchanged.

**Tech Stack:** React 19, Zustand, Hono, tRPC, TypeScript, Drizzle ORM, Vitest, existing Kimi API integration.

---

### Task 1: Lock shared runtime contracts

**Files:**
- Create: `contracts/aura-runtime.ts`
- Create: `src/lib/aura-runtime.ts`
- Test: `src/lib/aura-runtime.test.ts`

- [ ] **Step 1: Write the failing client helper test**

Cover:
- classic runtime resolves to `/api/kimi/chat/stream`
- `aura-medical-v1` resolves to `/api/aura-medical/chat/stream`
- invalid or missing input falls back to `classic`

- [ ] **Step 2: Run the focused test**

Run: `node .\\node_modules\\vitest\\vitest.mjs run src/lib/aura-runtime.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Add shared runtime enums and client helpers**

Define:
- runtime version union
- medical mode union
- policy level union
- endpoint resolver

### Task 2: Add medical runtime server shaping

**Files:**
- Create: `server/services/aura-medical-runtime.ts`
- Create: `server/services/aura-medical-runtime.test.ts`
- Create: `server/services/aura-medical-context-loader.ts`

- [ ] **Step 1: Write the failing server helper test**

Cover:
- research mode injects evidence-oriented instructions
- research mode adds scientific/web tool preference
- personal-health mode keeps the interpretive-on-request policy wording
- tool-result parsing extracts PubMed and ClinicalTrials links when present

- [ ] **Step 2: Run the focused server helper test**

Run: `node .\\node_modules\\vitest\\vitest.mjs run server/services/aura-medical-runtime.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Implement runtime shaping helpers**

Add:
- prompt addendum builder
- tool preference builder
- stage label builder
- evidence extraction helper

- [ ] **Step 4: Add the context-loader wrapper**

Wrap the current Kimi context loader instead of rewriting it.

### Task 3: Extend the Kimi turn pipeline for runtime metadata

**Files:**
- Modify: `server/trpc/chat-router.ts`
- Modify: `server/services/kimi-conversation-turn-service.ts`
- Modify: `server/services/kimi-conversation-turn-service.test.ts`

- [ ] **Step 1: Write the failing metadata test**

Cover:
- `aura-medical-v1` user input fields flow into assistant metadata
- assistant metadata includes runtime version, mode, and policy level
- parsed research evidence is persisted when tool results include supported URLs

- [ ] **Step 2: Run the focused Kimi service test**

Run: `node .\\node_modules\\vitest\\vitest.mjs run server/services/kimi-conversation-turn-service.test.ts`
Expected: FAIL for the new assertions.

- [ ] **Step 3: Extend the send-message input schema**

Add optional fields:
- `runtimeVersion`
- `medicalMode`
- `policyLevel`

- [ ] **Step 4: Merge runtime metadata into persisted messages**

Keep classic behavior intact.

### Task 4: Expose the new stream route

**Files:**
- Modify: `server/services/kimi-runtime.ts`
- Modify: `server/http-app.ts`
- Create: `api/aura-medical/chat/stream.ts`
- Modify: `api/kimi/routes.test.ts`

- [ ] **Step 1: Add the new runtime service entrypoint**

Instantiate the Kimi service with the Aura medical context loader.

- [ ] **Step 2: Add `/api/aura-medical/chat/stream`**

Mirror the current stream transport contract.

- [ ] **Step 3: Add a route exposure test**

Verify the Vercel route handler exports correctly.

### Task 5: Wire the frontend controls and request routing

**Files:**
- Modify: `src/hooks/useStore.ts`
- Modify: `src/hooks/useKimiChatData.ts`
- Modify: `src/pages/KimiChat.tsx`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add runtime state to the chat store**

Track:
- runtime version
- medical mode
- policy level

- [ ] **Step 2: Route stream requests by runtime**

`useKimiChatData` should call the resolved endpoint and send the runtime fields in the body.

- [ ] **Step 3: Add compact controls in the Kimi chat header**

Expose:
- runtime selector
- mode selector
- policy status

- [ ] **Step 4: Render persisted runtime metadata cleanly**

Keep the existing evidence card behavior and add small metadata pills only where useful.

### Task 6: Verify the slice

**Files:**
- No new code unless verification finds regressions

- [ ] **Step 1: Run focused tests**

Run: `node .\\node_modules\\vitest\\vitest.mjs run src/lib/aura-runtime.test.ts server/services/aura-medical-runtime.test.ts server/services/kimi-conversation-turn-service.test.ts api/kimi/routes.test.ts`
Expected: PASS

- [ ] **Step 2: Run TypeScript build**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Sanity-check the runtime wiring**

Confirm:
- classic endpoint still exists
- Aura medical endpoint exists
- frontend compiles with the new runtime state
- assistant metadata includes the selected runtime fields

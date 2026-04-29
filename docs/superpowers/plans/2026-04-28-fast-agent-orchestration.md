# Fast Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chat fast by default, consult specialists only when needed, and give agents a clearer identity and response contract.

**Architecture:** Add two pure backend services for consultation policy and prompt composition, test them first, then refactor the chat router to use them. Keep the current schema and data model, but switch the runtime to a turn-level consult policy.

**Tech Stack:** TypeScript, Hono, tRPC, Drizzle ORM, Vitest, React, Zustand

---

### Task 1: Consultation Policy

**Files:**
- Create: `app/api/services/consultation-policy.ts`
- Create: `app/api/services/consultation-policy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resolveConsultationPlan } from "./consultation-policy";

describe("resolveConsultationPlan", () => {
  it("consults only explicitly mentioned agents for non-generalist primaries", () => {
    const result = resolveConsultationPlan({
      primaryAgentSlug: "bloodwork",
      availableSupportingAgentSlugs: ["nutrition", "supplements"],
      userMessage: "@nutrition compare my ferritin with my diet",
    });

    expect(result.consultedAgentSlugs).toEqual(["nutrition"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/services/consultation-policy.test.ts`
Expected: FAIL because `resolveConsultationPlan` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function resolveConsultationPlan() {
  return { consultedAgentSlugs: [] };
}
```

- [ ] **Step 4: Run test to verify it passes or fails meaningfully**

Run: `npm test -- api/services/consultation-policy.test.ts`
Expected: FAIL with expectation mismatch, proving the test is exercising behavior.

- [ ] **Step 5: Implement the real consultation policy**

```ts
// Implement explicit mention matching, generalist-only auto consult,
// and a capped list of consulted specialists.
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- api/services/consultation-policy.test.ts`
Expected: PASS

### Task 2: Prompt Composer

**Files:**
- Create: `app/api/services/prompt-composer.ts`
- Create: `app/api/services/prompt-composer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildPrimarySystemPrompt } from "./prompt-composer";

describe("buildPrimarySystemPrompt", () => {
  it("includes tone, role, and consultation policy", () => {
    const prompt = buildPrimarySystemPrompt({
      agentName: "Generalist",
      basePrompt: "You are a general health intelligence agent.",
      responseStyle: "detailed",
      canConsultSpecialists: true,
    });

    expect(prompt).toContain("Generalist");
    expect(prompt).toContain("consult");
    expect(prompt).toContain("clear");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/services/prompt-composer.test.ts`
Expected: FAIL because the prompt composer does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildPrimarySystemPrompt() {
  return "";
}
```

- [ ] **Step 4: Run test to verify it fails meaningfully**

Run: `npm test -- api/services/prompt-composer.test.ts`
Expected: FAIL with missing substrings.

- [ ] **Step 5: Implement layered prompt builders**

```ts
// Implement builders for primary and supporting prompts with concise contracts.
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- api/services/prompt-composer.test.ts`
Expected: PASS

### Task 3: Chat Router Fast-Path

**Files:**
- Modify: `app/api/chat-router.ts`
- Modify: `app/api/services/context-assembler.ts`
- Use: `app/api/services/consultation-policy.ts`
- Use: `app/api/services/prompt-composer.ts`

- [ ] **Step 1: Refactor the router to compute a consultation plan before model calls**

```ts
// Replace direct use of calledAgentIds as the consulted list with a turn-level policy result.
```

- [ ] **Step 2: Shorten context windows and vault summaries**

```ts
// Limit recent messages and file summaries to a compact, stable size.
```

- [ ] **Step 3: Wire the new prompt builders into primary and supporting runs**

```ts
// Use layered prompt composition instead of raw fallback strings.
```

- [ ] **Step 4: Run targeted chat backend tests**

Run: `npm test -- api/services/consultation-policy.test.ts api/services/prompt-composer.test.ts`
Expected: PASS

### Task 4: Frontend Chat UX

**Files:**
- Modify: `app/src/pages/Chat.tsx`
- Modify: `app/src/types/index.ts`

- [ ] **Step 1: Update metadata types to distinguish available helpers from consulted helpers**

```ts
// Extend message metadata with consultedAgentNames and consultedAgentSlugs if needed.
```

- [ ] **Step 2: Update the chat UI copy to show that supporting agents assist only when used**

```tsx
// Show "available helpers" separately from "consulted this reply".
```

- [ ] **Step 3: Run the type checker**

Run: `npm run check`
Expected: PASS

### Task 5: Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run: `npm test -- api/services/consultation-policy.test.ts api/services/prompt-composer.test.ts`
Expected: PASS

- [ ] **Step 2: Run full type-check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Run the project test suite**

Run: `npm test`
Expected: PASS

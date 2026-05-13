# Multi-LLM Dashboard UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove visible `Kimi` branding from the authenticated dashboard UI, prioritize mobile overview utility, and surface only favorite agents in main dashboard entry points.

**Architecture:** Keep the existing `/kimi/*` route structure and internal naming intact while updating only user-visible copy and section ordering. Reuse `favoriteAgents` and `favoriteAgentIds` for overview and sidebar rendering so the dashboard presents the pinned workflow instead of the full built-in catalog.

**Tech Stack:** React 19, React Router 7, TanStack Query, Zustand, Tailwind CSS, Vitest

---

### Task 1: Lock favorite-agent selection behavior with tests

**Files:**
- Modify: `src/lib/dashboard-agents.test.ts`
- Review: `src/lib/dashboard-agents.ts`

- [ ] **Step 1: Add a failing test for desktop-style favorite ordering**

```ts
it("keeps generalist first without duplicating it when favorites already include it", () => {
  const result = getMobileOverviewAgents(AGENTS, [
    "generalist",
    "generalist",
    "bloodwork",
  ]);

  expect(result.map((agent) => agent.slug)).toEqual([
    "generalist",
    "bloodwork",
  ]);
});
```

- [ ] **Step 2: Run the focused test file and verify the new assertion fails only if the helper regresses**

Run: `npm test -- src/lib/dashboard-agents.test.ts`
Expected: existing suite runs and reveals whether the new ordering assumption is already satisfied

- [ ] **Step 3: Adjust helper logic only if the new test exposes a gap**

```ts
const orderedIds = Array.from(
  new Set(["generalist", ...favoriteAgentIds.filter(Boolean)])
);
```

- [ ] **Step 4: Re-run the focused helper test file**

Run: `npm test -- src/lib/dashboard-agents.test.ts`
Expected: PASS

### Task 2: Update navigation labels and branded header copy

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/kimi/KimiHeader.tsx`
- Test: `src/components/layout/Sidebar.test.ts`

- [ ] **Step 1: Add a failing sidebar test for neutral navigation labels**

```ts
expect(markup).toContain("Chat");
expect(markup).toContain("Agents");
expect(markup).toContain("Vault");
expect(markup).not.toContain("Kimi Chat");
expect(markup).not.toContain("Kimi Agents");
expect(markup).not.toContain("Kimi Vault");
```

- [ ] **Step 2: Run the sidebar test and verify it fails on current labels**

Run: `npm test -- src/components/layout/Sidebar.test.ts`
Expected: FAIL because the rendered nav still contains `Kimi Chat`, `Kimi Agents`, and `Kimi Vault`

- [ ] **Step 3: Replace visible navigation labels and branded header copy**

```ts
{ id: "kimi-chat", label: "Chat", icon: Sparkles, path: "/kimi/chat" }
{ id: "kimi-agents", label: "Agents", icon: Brain, path: "/kimi/agents" }
{ id: "kimi-vault", label: "Vault", icon: Zap, path: "/kimi/vault" }
```

```ts
const kimiTabs = [
  { to: "/kimi/chat", label: "Chat", icon: MessageSquareCode },
  { to: "/kimi/agents", label: "Agents", icon: BrainCircuit },
  { to: "/kimi/vault", label: "Vault", icon: DatabaseZap },
];
```

- [ ] **Step 4: Rewrite the header chip copy to stay provider-agnostic**

```tsx
<p className="text-[11px] font-medium uppercase tracking-[0.25em] text-amber-200/65">
  Aura Workspace
</p>
...
<div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/60">
  Multi-model workspace
  <div className="mt-1 text-[14px] font-medium text-white">
    Chat, agents, and vault context
  </div>
</div>
```

- [ ] **Step 5: Re-run the sidebar test**

Run: `npm test -- src/components/layout/Sidebar.test.ts`
Expected: PASS

### Task 3: Rework the overview for neutral copy and mobile-first order

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Reuse: `src/hooks/useAgentCatalog.ts`
- Reuse: `src/lib/dashboard-agents.ts`

- [ ] **Step 1: Replace visible `Kimi` copy in the overview header, stats, focus panel, and empty states**

```tsx
<p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground/40">
  {user?.name
    ? `${user.name}, this workspace now revolves around chat, agents, and vault context.`
    : "Aura now revolves around chat, agents, and vault context."}
</p>
```

```tsx
label="Chats"
```

```tsx
<p className="px-3 py-4 text-[12px] text-muted-foreground/35">
  There are no files in Vault yet.
</p>
```

- [ ] **Step 2: Change the overview agent sections to use favorite agents instead of `BUILT_IN_AGENTS`**

```tsx
{favoriteAgents.map(agent => (
  <button key={agent.slug} ...>
    ...
  </button>
))}
```

- [ ] **Step 3: Move the mobile stats block above the mobile agents block and recent uploads above the editorial panel**

```tsx
{isMobile ? (
  <>
    <StatsSection />
    <RecentUploadsSection />
    <FocusSection />
    <FavoriteAgentsSection />
  </>
) : (
  <>
    <FavoriteAgentsSection />
    <StatsSection />
    <DesktopLowerSections />
  </>
)}
```

- [ ] **Step 4: Keep a clear agents CTA while avoiding the old branded label**

```tsx
<p className="text-[13px] font-medium text-foreground">
  Open Agents
</p>
```

- [ ] **Step 5: Run the focused test files that cover helper selection and shared routes**

Run: `npm test -- src/lib/dashboard-agents.test.ts src/App.test.tsx`
Expected: PASS

### Task 4: Update visible copy in chat, agents, vault, and settings pages

**Files:**
- Modify: `src/pages/KimiChat.tsx`
- Modify: `src/pages/KimiAgents.tsx`
- Modify: `src/pages/KimiVault.tsx`
- Modify: `src/pages/KimiAgentSettings.tsx`

- [ ] **Step 1: Replace user-visible `Kimi` strings with neutral English labels**

```tsx
runtime.runtimeVersion === "aura-medical-v1" ? "Aura medical runtime" : "Chat"
```

```tsx
<p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/35">
  Agents
</p>
```

```tsx
<button ...>Back to Agents</button>
```

- [ ] **Step 2: Keep provider-technical controls working but rewrite helper copy so it reads generically**

```tsx
description="Adjust how this profile uses reasoning, memory, official tools, and model routing inside the current runtime."
```

```tsx
<p className="text-[12px] font-medium text-foreground">
  Prefer primary memory
</p>
```

- [ ] **Step 3: Re-run the route and sidebar tests after the cross-page copy pass**

Run: `npm test -- src/App.test.tsx src/components/layout/Sidebar.test.ts`
Expected: PASS

### Task 5: Verify the final UX pass

**Files:**
- Review: `src/pages/Dashboard.tsx`
- Review: `src/components/layout/Sidebar.tsx`
- Review: `src/pages/KimiChat.tsx`
- Review: `src/pages/KimiAgents.tsx`
- Review: `src/pages/KimiVault.tsx`
- Review: `src/pages/KimiAgentSettings.tsx`

- [ ] **Step 1: Run the targeted verification suite**

Run: `npm test -- src/lib/dashboard-agents.test.ts src/components/layout/Sidebar.test.ts src/App.test.tsx`
Expected: PASS

- [ ] **Step 2: Run a type-aware project check if the focused tests pass**

Run: `npm run check`
Expected: exit code 0

- [ ] **Step 3: Inspect the diff for accidental route or internal naming changes**

Run: `git diff -- src/pages/Dashboard.tsx src/components/layout/Sidebar.tsx src/components/kimi/KimiHeader.tsx src/pages/KimiChat.tsx src/pages/KimiAgents.tsx src/pages/KimiVault.tsx src/pages/KimiAgentSettings.tsx`
Expected: only visible copy, overview ordering, and favorite-agent rendering changes

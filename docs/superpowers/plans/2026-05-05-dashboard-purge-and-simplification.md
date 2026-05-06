# Dashboard Purge And Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave the current functional dashboard as the single canonical project, removing duplicated, extra, legacy, and irrelevant files while preserving the working Kimi chat flow.

**Architecture:** The cleanup proceeds from outermost risk to innermost risk. First isolate the canonical project and reduce workspace noise, then remove tracked artifacts and legacy UI/routes inside `app`, then simplify agent/catalog sources so the current chat experience depends on fewer moving parts. Every destructive step must be followed by targeted verification before continuing.

**Tech Stack:** PowerShell, Git, React 19, Vite, Hono, tRPC, Zustand, Vitest, Drizzle, Supabase

---

## File Structure

**Canonical project**
- Keep: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app`
- Verify only as references during cleanup: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app-6a2c315`
- Verify only as references during cleanup: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/fork backend`
- Verify only as references during cleanup: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/landing-aura-v1`

**Workspace files likely to change**
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/package.json`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/package-lock.json`
- Create or modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/README.md`
- Move or delete after verification: sibling folders outside `app`

**Tracked app files likely to change**
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/.gitignore`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/App.tsx`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/hooks/useStore.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/hooks/useAgentCatalog.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/lib/data.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiChat.tsx`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiAgents.tsx`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiAgentSettings.tsx`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/server/queries/agents.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/server/services/agent-registry.ts`

**Tracked app files likely to delete**
- Delete: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/Agents.tsx`
- Delete: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/AgentSettings.tsx`
- Delete: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/Chat.tsx`
- Delete: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/Vault.tsx`
- Delete if unused after import audit: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/components/kimi/KimiLaunchpad.tsx`
- Delete tracked build/log artifacts after verification: any tracked file under `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/dist`

**Verification targets**
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiChat.tsx`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/hooks/useKimiChatData.ts`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/server/trpc/chat-router.ts`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/lib/chat-stream.test.ts`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/server/services/kimi-conversation-turn-service.test.ts`

### Task 1: Prepare An Isolated Cleanup Branch

**Files:**
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/.git`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/docs/superpowers/plans/2026-05-05-dashboard-purge-and-simplification.md`

- [ ] **Step 1: Create a dedicated cleanup branch from the checkpoint**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" checkout -b codex/dashboard-purge
```

Expected: Git switches from `main` to `codex/dashboard-purge`.

- [ ] **Step 2: Verify the branch contains the checkpoint commit**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" log --oneline -1
```

Expected: The latest commit is `a2558ab chore: checkpoint before cleanup` or a direct descendant if the branch was recreated.

- [ ] **Step 3: Record a clean starting status**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" status --short --branch
```

Expected: The branch is `codex/dashboard-purge` and there are no uncommitted changes before cleanup edits start.

### Task 2: Canonicalize The Workspace Root

**Files:**
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/package.json`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/package-lock.json`
- Create: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/README.md`
- Move or delete after verification: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app-6a2c315`
- Move or delete after verification: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/fork backend`
- Move or delete after verification: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/landing-aura-v1`

- [ ] **Step 1: Verify the root wrapper only points at `app`**

Run:

```powershell
Get-Content "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/package.json"
```

Expected: All root scripts delegate to `npm --prefix app ...`.

- [ ] **Step 2: Add a root README that declares `app` as the only active project**

Implementation:
- Explain that `app` is the canonical dashboard.
- Mark sibling folders as archival or pending removal.
- Document the one valid local entrypoint: `npm run dev` from the workspace root or `npm run dev` inside `app`.

- [ ] **Step 3: Remove or archive sibling project folders that are not part of the canonical dashboard**

Implementation:
- Move `app-6a2c315`, `fork backend`, and `landing-aura-v1` into a clearly named archive area such as `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/_archive`.
- If moving is not possible cleanly, delete them only after confirming they are not referenced by root scripts.

- [ ] **Step 4: Re-check the root tree**

Run:

```powershell
Get-ChildItem "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2" -Force
```

Expected: The root is understandable at a glance and no longer presents multiple active app candidates.

- [ ] **Step 5: Commit the workspace canonicalization**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" status --short
```

Expected: Only intended app repo changes are present in git; root-only non-git moves stay outside the app repository.

### Task 3: Remove Tracked Artifacts And Runtime Noise From `app`

**Files:**
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/.gitignore`
- Delete: tracked files under `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/dist`
- Check only: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/.vercel`
- Check only: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/.codex-temp`

- [ ] **Step 1: Verify which generated files are tracked**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" ls-files dist .vercel .codex-temp
```

Expected: `dist` may contain tracked outputs; `.vercel` and `.codex-temp` should ideally be untracked.

- [ ] **Step 2: Ensure ignore rules cover generated folders and logs**

Implementation:
- Keep `dist`, `.vercel`, and log patterns ignored.
- Add `.codex-temp/` explicitly if missing.

- [ ] **Step 3: Delete tracked build outputs from git control**

Implementation:
- Remove `dist/boot.js` and any other tracked build assets from the repository tree.
- Do not touch source files under `api`, `server`, `src`, `db`, or `supabase`.

- [ ] **Step 4: Verify the app still builds from source, not from committed artifacts**

Run:

```powershell
npm --prefix "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" run check
```

Expected: TypeScript compilation passes without relying on `dist`.

- [ ] **Step 5: Commit the artifact cleanup**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" add .gitignore dist
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" commit -m "chore: remove generated app artifacts"
```

Expected: A focused commit for tracked artifact removal.

### Task 4: Remove Legacy Pages And Route Duplication

**Files:**
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/App.tsx`
- Delete: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/Agents.tsx`
- Delete: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/AgentSettings.tsx`
- Delete: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/Chat.tsx`
- Delete: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/Vault.tsx`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiAgents.tsx`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiAgentSettings.tsx`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiChat.tsx`

- [ ] **Step 1: Audit imports and route dependencies on legacy pages**

Run:

```powershell
Get-ChildItem -Path "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src" -Recurse | Select-String -Pattern "Agents|AgentSettings|Chat|Vault"
```

Expected: Only route redirects or obsolete references remain for the legacy pages.

- [ ] **Step 2: Simplify routing to keep only canonical `/kimi/*` screens**

Implementation:
- Preserve redirect compatibility for `/agents`, `/chat`, and `/vault`.
- Remove any direct import dependency on the legacy page files.

- [ ] **Step 3: Delete the unused legacy page files**

Implementation:
- Remove `Agents.tsx`, `AgentSettings.tsx`, `Chat.tsx`, and `Vault.tsx` once import audit is clean.

- [ ] **Step 4: Verify route compilation**

Run:

```powershell
npm --prefix "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" run check
```

Expected: No missing import or route type errors.

- [ ] **Step 5: Commit the route cleanup**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" add src/App.tsx src/pages
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" commit -m "refactor: remove legacy dashboard routes"
```

Expected: The commit only contains route and page cleanup.

### Task 5: Reduce Agents To A Small Canonical Set

**Files:**
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/lib/data.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/hooks/useStore.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/hooks/useAgentCatalog.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/server/queries/agents.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/server/services/agent-registry.ts`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiAgents.tsx`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiAgentSettings.tsx`

- [ ] **Step 1: Define the exact six agents to keep in the canonical catalog**

Implementation:
- Keep `generalist` plus five supporting agents that already fit the current UI and backend data model.
- Remove marketplace/demo-only excess agents from the frontend source of truth.

- [ ] **Step 2: Update the frontend `AGENTS` source to only expose those six**

Implementation:
- Remove unused static agent entries.
- Preserve icon, color, prompt, tags, and vault categories for the six survivors.

- [ ] **Step 3: Update default store state and favorites to match the reduced catalog**

Implementation:
- Ensure `generalist` remains default and pinned.
- Prevent stale favorite IDs from referencing removed agents.

- [ ] **Step 4: Update backend catalog seeding to stop reintroducing removed agents**

Implementation:
- Make `ensureConversationalCatalogSeeded` and related seed logic derive from the reduced `AGENTS` list.
- Preserve existing query shapes so the agents screens and chat still work.

- [ ] **Step 5: Write or adjust failing tests for agent count and canonical defaults**

Run:

```powershell
npm --prefix "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" run test -- src/lib/dashboard-agents.test.ts
```

Expected: The test fails first if the UI still references removed agents.

- [ ] **Step 6: Make the minimal implementation pass**

Run:

```powershell
npm --prefix "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" run test -- src/lib/dashboard-agents.test.ts
```

Expected: The focused test passes with the reduced catalog.

- [ ] **Step 7: Commit the agent simplification**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" add src/lib/data.ts src/hooks/useStore.ts src/hooks/useAgentCatalog.ts server/queries/agents.ts server/services/agent-registry.ts
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" commit -m "refactor: reduce dashboard agents to canonical six"
```

Expected: The commit isolates agent catalog simplification.

### Task 6: Simplify Chat Surface Without Breaking Behavior

**Files:**
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiChat.tsx`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/hooks/useKimiChatData.ts`
- Modify: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/lib/chat-experience.ts`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/components/kimi/KimiHeader.tsx`
- Delete if unused after import audit: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/components/kimi/KimiLaunchpad.tsx`

- [ ] **Step 1: Audit the current chat page for dead toggles, duplicated labels, and unused imports**

Run:

```powershell
Get-Content "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/src/pages/KimiChat.tsx"
```

Expected: A list of UI controls that are no longer essential to the final simplified chat.

- [ ] **Step 2: Keep the current working stream path and conversation query param behavior intact**

Implementation:
- Do not change `conversation` query handling.
- Do not change `streamMessage` contract unless a failing test requires it.

- [ ] **Step 3: Remove chat UI branches that are cosmetic or redundant**

Implementation:
- Keep the working message list, composer, helper chips only if they are still used, and runtime state that the backend requires.
- Remove unused components or helper UI that no longer participates in the final interaction model.

- [ ] **Step 4: Run focused chat regression tests**

Run:

```powershell
npm --prefix "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" run test -- src/lib/chat-stream.test.ts server/services/kimi-conversation-turn-service.test.ts server/trpc/chat-router.test.ts
```

Expected: Chat stream and conversation tests pass after simplification.

- [ ] **Step 5: Commit the chat surface cleanup**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" add src/pages/KimiChat.tsx src/hooks/useKimiChatData.ts src/lib/chat-experience.ts src/components/kimi
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" commit -m "refactor: simplify kimi chat surface"
```

Expected: The commit contains only chat-surface cleanup.

### Task 7: Full Verification And Publish The Cleanup Branch

**Files:**
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/package.json`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/vitest.config.ts`
- Check: `C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app/docs/superpowers/plans/2026-05-05-dashboard-purge-and-simplification.md`

- [ ] **Step 1: Run the compile check**

Run:

```powershell
npm --prefix "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" run check
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run the relevant test suite**

Run:

```powershell
npm --prefix "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" run test
```

Expected: PASS, or a clearly documented list of pre-existing failures if the suite is already unstable.

- [ ] **Step 3: Run a final git diff review**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" status --short
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" diff --stat
```

Expected: Only intended cleanup changes remain.

- [ ] **Step 4: Push the cleanup branch**

Run:

```powershell
git -C "C:/Users/gasto/OneDrive/Escritorio/kimi dashboard v2/app" push -u origin codex/dashboard-purge
```

Expected: The branch is published and ready for review or merge.

- [ ] **Step 5: Summarize the final architecture**

Implementation:
- State the final active workspace structure.
- State the six kept agents.
- State which legacy pages and artifacts were removed.

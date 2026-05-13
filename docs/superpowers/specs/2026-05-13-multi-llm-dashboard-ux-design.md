# Multi-LLM Dashboard UX Design

**Date:** 2026-05-13

**Goal**

Remove visible `Kimi` branding from the authenticated dashboard UI, make the overview feel mobile-first, and ensure the main dashboard only surfaces favorite agents while keeping internal routes, filenames, and provider-specific implementation details unchanged.

## Scope

This design applies only to user-visible dashboard UI inside the authenticated app.

Included:
- visible navigation labels
- overview copy and stat labels
- visible page titles and helper copy in chat, agents, vault, and agent settings
- mobile ordering and emphasis in the overview page
- agent surfacing rules in the dashboard and sidebar

Excluded:
- internal route paths such as `/kimi/chat`
- component and file names
- backend services, provider routing, or model selection logic
- database or API schema changes

## Product Intent

The dashboard should stop feeling tied to one provider and instead read like an Aura workspace that can support multiple LLMs over time. The UI should speak in generic product terms:
- `Chat`
- `Agents`
- `Vault`
- `Chats`

On mobile, the first screen should prioritize quick status and recent activity over editorial copy or long agent lists. The most useful information should appear first with minimal scrolling.

## UX Decisions

### 1. Visible naming becomes provider-agnostic

Replace visible `Kimi` labels in the authenticated UI with neutral English labels.

Examples:
- `Kimi Chat` -> `Chat`
- `Kimi Agents` -> `Agents`
- `Kimi Vault` -> `Vault`
- `Kimi chats` -> `Chats`
- `Open Kimi Agents` -> `Open Agents`
- `Kimi focus` -> `Workspace focus`
- `Kimi-first` -> remove or replace with a neutral workspace label

Provider-specific wording that is currently visible in helper copy should also be rewritten to avoid positioning the workspace around Kimi.

### 2. Overview becomes mobile-first

On mobile, the overview should be re-ordered so the first content block after the header is the stats grid:
- `Vault files`
- `Favorite agents`
- `Chats`
- `Signed-in user`

After the stats grid:
- `Recent uploads`
- focus/editorial panel
- favorite agent cards or agents CTA

This order keeps high-signal information above the fold and pushes secondary explanation lower in the page.

Desktop can keep a richer layout, but it should use the same neutral naming and should not highlight the full built-in catalog by default.

### 3. Main dashboard surfaces favorites only

The main dashboard should stop auto-listing the entire built-in agent catalog in overview sections.

Rules:
- sidebar keeps showing only favorites
- mobile overview shows favorite agents only
- desktop overview should also prefer favorite agents rather than the full built-in list
- the dedicated `Agents` page remains the place to browse and manage the full catalog

This aligns the dashboard with the user's pinned workflow instead of showing every agent everywhere.

### 4. Dedicated pages keep internal behavior but change visible copy

Visible copy in these pages should be updated:
- chat page
- agents page
- agent settings page
- vault page

The page behavior, routes, and state wiring should stay the same unless a small UI adjustment is required to support the new copy or favorite-agent presentation.

## Technical Design

### Target files

Primary files:
- `src/pages/Dashboard.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/pages/KimiAgents.tsx`
- `src/pages/KimiChat.tsx`
- `src/pages/KimiVault.tsx`
- `src/pages/KimiAgentSettings.tsx`
- `src/components/kimi/KimiHeader.tsx`

Supporting logic to reuse rather than replace:
- `src/hooks/useAgentCatalog.ts`
- `src/lib/dashboard-agents.ts`
- `src/lib/data.ts`

### Data and state strategy

No new data model is needed.

Use existing favorite-agent sources:
- `favoriteAgents`
- `favoriteAgentIds`

The overview should derive visible cards from this favorite-agent state instead of from `BUILT_IN_AGENTS` for the main dashboard experience.

### Layout strategy

`Dashboard.tsx` should branch more intentionally between mobile and desktop sections:
- mobile: stack sections in the new order
- desktop: keep current density, but use favorite agents and neutral copy

The implementation should avoid duplicating business logic. Shared data derivations should stay memoized and only the rendered section order should diverge where needed.

## Copy Guidelines

Keep all new copy in English.

Tone:
- concise
- neutral
- product-agnostic
- clear on mobile

Avoid:
- provider names in visible dashboard copy
- `Kimi-first` framing
- copy that implies only one model provider is supported

## Risks

### Low risk
- replacing labels and helper copy
- reordering sections in overview
- switching overview grids from all agents to favorite agents

### Moderate risk
- desktop empty states if a user has no favorites
- mobile spacing regressions after reordering cards and content blocks
- hidden residual `Kimi` strings in less obvious helper components

## Validation

Manual validation should confirm:
- no visible `Kimi` labels remain in the authenticated dashboard flow where this spec applies
- mobile overview opens with stats first, then recent uploads
- main dashboard only shows favorite agents in overview and sidebar
- dedicated `Agents` page still supports browsing and managing the catalog
- internal `/kimi/*` routes continue functioning without visible regression

## Out of Scope Follow-up

A later phase can introduce explicit user model selection and deeper provider-agnostic settings language. That future work should happen separately from this UI cleanup so the current change stays low-risk and easy to verify.

# Aura Core Cleanup Design

## Goal

Make Aura faster to use, easier to understand, and safer to improve by cleaning the active product path before adding another layer of features.

The first implementation phase should improve:

- perceived speed in chat, agents, vault, login, and dashboard
- code clarity around active Aura/Venice runtime behavior
- component boundaries for the largest frontend pages
- backend route boundaries for chat and vault
- lint health and React render hygiene

This is a foundation pass, not a full redesign. It should leave the app looking familiar while making the codebase feel dramatically more workable.

## Current State

The stable MVP is documented as a Venice-first Aura app using:

- `POST /api/chat/send` as the production chat path
- Supabase Auth plus backend app session sync
- persisted conversations
- persisted vault files and ingestion lifecycle
- agents as product profiles around the chat experience

The codebase is healthier than a prototype because `npm run check` passes, but it is still carrying transition weight:

- large page components: `src/pages/KimiChat.tsx`, `src/pages/KimiVault.tsx`, `src/pages/Home.tsx`, `src/pages/KimiAgents.tsx`
- active Aura product surfaces still named after Kimi internally
- old runtime concepts such as medical mode and stream aliases remain near the active path
- `server/http-app.ts` owns too many unrelated HTTP concerns
- `server/services/model-gateway.ts` mixes provider client code, model catalog, diagnostics, cache, and error policy
- `npm run lint` reports errors in React effects, unsafe `any`, unused variables, Fast Refresh boundaries, impure render logic, and legacy services

## Non-Goals

- Do not rebuild the whole UI from scratch.
- Do not remove compatibility routes until tests prove no active path depends on them.
- Do not add another model provider.
- Do not introduce a new design system.
- Do not turn this phase into a broad product expansion.
- Do not change Supabase schema except for a clearly required migration.

## Product Direction

Aura should feel like one coherent app:

- Chat is the primary working surface.
- Agents are profiles and controls that make chat more useful.
- Vault is the private context layer that makes answers better.
- Login should be fast, trustworthy, and aligned with the same Aura story.
- Landing/web should explain the product without competing with the app.

The first screen after login should optimize for action: continue a chat, start a chat with an agent, inspect vault readiness, or upload context.

## Architecture Target

### Frontend

Split large pages into feature-owned modules while preserving current routes.

Recommended module shape:

- `src/features/chat/`
  - `ChatPage.tsx`
  - `ChatComposer.tsx`
  - `MessageList.tsx`
  - `MessageBubble.tsx`
  - `ModelPicker.tsx`
  - `HelperPicker.tsx`
  - `ChatContextStrip.tsx`
  - `useAuraChatData.ts`
- `src/features/vault/`
  - `VaultPage.tsx`
  - `VaultDocumentTable.tsx`
  - `VaultDocumentCard.tsx`
  - `VaultPreviewDialog.tsx`
  - `VaultUploadDialog.tsx`
  - `useVaultDocuments.ts`
  - `useVaultPreview.ts`
- `src/features/agents/`
  - `AgentsPage.tsx`
  - `AgentCard.tsx`
  - `AgentFilters.tsx`
  - `AgentSettingsPage.tsx`
- `src/features/landing/`
  - internal landing sections if the current `Home.tsx` remains inside this app

Existing route files may stay as adapters during the migration:

- `src/pages/KimiChat.tsx` imports and renders `ChatPage`
- `src/pages/KimiVault.tsx` imports and renders `VaultPage`
- `src/pages/KimiAgents.tsx` imports and renders `AgentsPage`

This avoids route churn while making active code Aura-owned.

### Backend

Keep the active runtime simple and explicit:

- `server/chat/simple-chat-handler.ts` remains the JSON send handler.
- `server/services/venice-chat-runtime.ts` remains the active turn runtime.
- `server/http-app.ts` becomes a route composition file, not the owner of every route body.

Extract:

- `server/vault/vault-routes.ts` for vault document routes
- `server/chat/chat-routes.ts` for chat send, stream compatibility, provider check, and diagnose-turn routes
- `server/services/venice/venice-client.ts` for Venice HTTP calls
- `server/services/venice/venice-model-catalog.ts` for model list and curated fallback behavior
- `server/services/venice/venice-errors.ts` for provider error classification

Do not remove older Kimi or medical files in this phase unless they are proven unused and covered by tests. Prefer isolation first, deletion second.

## Performance Plan

Perceived speed should improve through smaller renders, clearer loading states, and less repeated work.

Frontend changes:

- lazy-load heavyweight route components where the shell can render first
- memoize stable derived data in chat, agents, and vault
- remove synchronous state-setting effects that React lint flags as render-cost risks
- avoid recreating empty arrays during render when those arrays feed hook dependencies
- split dialogs and menus so opening model/helper/vault preview does not force the entire page body to be mentally coupled
- add consistent skeleton or compact loading states for chat conversation, vault documents, agents, and auth workspace loading

Data changes:

- add sensible `staleTime` to model catalog, agent list, and vault list queries where freshness does not need millisecond precision
- avoid provider readiness checks on every chat send when a recent ready/failed state is already known
- keep vault polling only while files are non-terminal

Build/developer speed:

- fix the highest-signal lint errors in active files first
- avoid broad formatting churn
- keep tests focused around moved boundaries

## UX Improvements

### Chat

Make chat feel immediate:

- composer stays stable during send
- pending user message appears immediately
- model label and vault/agent context stay visible but compact
- error state includes retry and Auto model recovery
- no visible Kimi wording in user-facing text

### Agents

Make agents feel like useful profiles, not a catalog wall:

- default view highlights pinned/favorite agents
- search and filters remain lightweight
- cards show the practical state: memory, vault, web/research, preferred model
- settings page should be split enough to make save state and defaults obvious

### Vault

Make vault feel operational:

- document list should clearly show ready/processing/failed
- upload flow should explain auto category selection without blocking the user unnecessarily
- preview dialog should own preview loading and cleanup
- retry/reclassify actions should be visible only where useful

### Login

Make login fast and credible:

- primary sign-in should be obvious
- unavailable providers should not feel broken
- external landing URL should move to a constant/config if it remains external
- copy should align with Aura, not implementation history

### Landing/Web

Keep the landing internal or clearly external, but not ambiguous:

- one product story: private health intelligence with vault, agents, and chat
- shorter first screen with direct app entry
- no extra product claims that the MVP does not support yet

## Error Handling

Use consistent categories and visible recovery actions:

- auth/setup errors: retry sync, back to login
- provider errors: retry, use Auto/default model, show sanitized provider message
- vault errors: retry failed document or reprocess after category edit
- backend setup errors: show environment/setup category without exposing secrets

## Testing Plan

Run after implementation:

- `npm run check`
- focused tests for moved chat and vault helpers
- focused tests for route extraction if backend modules move
- `npm run lint` after active-file lint fixes

If full lint remains red because of legacy files, document the remaining errors and keep the active phase from adding new lint debt.

## Rollout Plan

1. Fix low-risk lint and React render issues in active frontend/backend files.
2. Extract chat UI modules while keeping `/kimi/chat` route behavior unchanged.
3. Extract vault UI modules while keeping upload, preview, reprocess, reclassify, and delete behavior unchanged.
4. Extract backend chat/vault route registration from `server/http-app.ts`.
5. Split Venice provider support out of `model-gateway.ts` only after route and UI tests are stable.
6. Tighten login and landing copy/config after the operational surfaces are cleaner.

## Success Criteria

- `npm run check` still passes.
- Active chat, agents, vault, dashboard, login, and landing routes still load.
- The main chat and vault pages are no longer single 30-40 KB components.
- User-facing product language consistently says Aura, Chat, Agents, Vault, and Login.
- Backend route files have clear ownership.
- Lint errors in touched active files are removed or explicitly documented if legacy-only debt remains.
- The app feels faster because the shell renders quickly, actions show immediate feedback, and fewer unrelated components are coupled.

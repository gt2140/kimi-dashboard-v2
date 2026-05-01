# Conversation Turn Pipeline Design

## Summary

This document defines the first re-architecture phase for Aura's conversational backend.

The focus is not "all of chat at once". The focus is the single production-critical path that is currently unstable:

- accept a user turn
- assemble context
- call the provider or fall back
- persist the turn
- close the stream deterministically

Today those responsibilities are tangled across `server/http-app.ts`, `server/trpc/chat-router.ts`, `server/services/model-gateway.ts`, and the persistence layer. That makes failures hard to classify and easy to leave half-finished. The result is visible in production through empty conversations, streams that show stages without completion, and provider failures that look like generic chat bugs.

This phase introduces a dedicated turn pipeline with explicit state transitions, isolated responsibilities, and guaranteed completion semantics.

## Goals

- Guarantee that every accepted chat turn ends in one of two terminal outcomes:
  - persisted assistant response
  - explicit terminal error/fallback with persisted evidence
- Eliminate the class of failures where a conversation is created but no user message or run is persisted.
- Make the stream contract deterministic so the frontend never waits forever after stages have started.
- Separate orchestration, persistence, provider execution, and fallback policy into independently testable units.
- Make provider failures operationally visible instead of silently degrading into misleading generic notes.

## Non-Goals

- No queue-based background workers in this phase.
- No multi-provider quality routing in this phase.
- No memory rewrite, review loop, or planner-based specialist orchestration in this phase.
- No frontend redesign beyond preserving the current `stage`, `text-delta`, `message-complete`, and `error` protocol.

## Current Failure Modes

The production investigation exposed several distinct failure modes that are currently coupled together:

1. Streaming lifecycle and provider lifecycle are not modeled as separate concerns.
2. The request may emit stages before durable persistence exists.
3. User message persistence happens too late in the flow, after expensive orchestration/provider work.
4. Provider failures can surface as generic limited-mode notes that hide the operational root cause.
5. A request can appear active from the user's perspective even when the backend is already in a failed or ambiguous state.
6. `chat-router.ts` owns too many responsibilities at once:
   - conversation validation
   - participant sync
   - context assembly
   - provider routing
   - fallback logic
   - streaming callbacks
   - message persistence
   - run persistence

This makes it difficult to reason about exactly where a turn is blocked and difficult to harden any one layer without changing several others.

## Design Principles

### 1. Persist early

As soon as a turn is accepted, the backend should durably record the user message and the turn record before starting expensive downstream work.

### 2. One owner per concern

Streaming, persistence, orchestration, provider execution, and fallback policy should each have a single clear owner.

### 3. Explicit state machine

A turn should move through explicit states instead of ad hoc control flow embedded in a large function.

### 4. Terminal guarantees

Once stages are emitted, the backend must always finish with either:

- `message-complete`
- `error`

The stream must never be left open without one of those terminal events.

### 5. Operational honesty

If a provider fails because of quota, timeout, or configuration, that fact should be captured in persistence and surfaced to the UI in a precise way.

## Proposed Architecture

### Request entrypoint

`server/http-app.ts`

Responsibilities:

- authenticate request
- validate input body
- create stream response
- delegate to `ConversationTurnService`
- translate terminal pipeline output into the existing NDJSON event protocol

It should not make business decisions about context, providers, or fallback selection.

### ConversationTurnService

New central service:

- `server/services/conversation-turn-service.ts`

Responsibilities:

- own the turn state machine
- coordinate repositories and sub-services
- emit stage updates at the correct moments
- guarantee one terminal outcome for the stream

This becomes the single orchestration entrypoint for synchronous conversational turns.

### ConversationRepository

New repository:

- `server/repositories/conversation-repository.ts`

Responsibilities:

- require conversation ownership
- persist the user message immediately after acceptance
- persist the assistant message in final form
- update conversation title, timestamps, and orchestration metadata

This removes conversation/message persistence from `chat-router.ts`.

### AgentRunRepository

New repository:

- `server/repositories/agent-run-repository.ts`

Responsibilities:

- create primary run record before provider execution
- move run status through `queued -> running -> completed|failed`
- persist prompt/context snapshots and final output/error

This gives us a durable operational trail even when the provider fails.

### TurnStreamController

New streaming helper:

- `server/services/turn-stream-controller.ts`

Responsibilities:

- own NDJSON event writing
- serialize event order
- prevent duplicate terminal events
- guarantee close after terminal event

The stream controller should expose a minimal interface:

- `emitStage(stage)`
- `emitDelta(delta)`
- `complete(message)`
- `fail(message)`

### ContextAssemblerService

Existing role kept but narrowed:

- collect recent messages
- collect allowed vault context
- collect agent settings and summary context
- return a context object

It should not know about stream wiring or write message/run records directly.

### ModelGatewayService

Existing role kept but narrowed further:

- execute provider requests
- normalize provider responses
- enforce request timeout
- enforce provider cooldown / operational block behavior

It should not know about conversations or repositories.

### FallbackPolicyService

New service:

- `server/services/fallback-policy-service.ts`

Responsibilities:

- classify operational failures
- choose whether to return limited mode
- produce user-visible and persisted fallback metadata

This makes fallback logic testable and keeps it out of the main turn pipeline.

## Turn State Machine

Each turn should have a simple explicit lifecycle:

1. `accepted`
2. `user_message_persisted`
3. `run_created`
4. `context_ready`
5. `provider_running`
6. terminal branch:
   - `provider_completed`
   - `provider_failed`
7. `assistant_message_persisted`
8. `run_finalized`
9. `stream_completed`

Important invariants:

- no stage emission before `user_message_persisted`
- no provider call before `run_created`
- no `message-complete` before assistant persistence succeeds
- any failure after `run_created` must finalize the run as failed

## Proposed Flow

### Successful turn

1. HTTP handler authenticates and validates input.
2. `ConversationTurnService` validates conversation ownership.
3. `ConversationRepository` persists the user message.
4. `AgentRunRepository` creates the primary run with status `queued`, then marks it `running`.
5. Stream emits `analyze`.
6. `ContextAssemblerService` builds runtime context.
7. Stream emits `context`.
8. `ModelGatewayService` executes provider.
9. Stream emits `draft`.
10. `TurnStreamController` emits deltas as they arrive.
11. Final assistant content is assembled.
12. `ConversationRepository` persists the assistant message.
13. `AgentRunRepository` persists final output and marks run `completed`.
14. `TurnStreamController` emits `message-complete`.
15. Stream closes.

### Provider failure with limited fallback

1. User message and run are already persisted before provider execution.
2. Provider fails with a typed operational reason.
3. `FallbackPolicyService` produces limited-mode content and note.
4. Assistant fallback message is persisted.
5. Primary run is finalized as `failed` with precise failure reason.
6. `TurnStreamController` emits fallback text deltas if applicable.
7. `TurnStreamController` emits `message-complete`.
8. Stream closes.

### Non-recoverable pipeline failure

Examples:

- conversation ownership invalid
- message persistence fails
- run creation fails
- assistant persistence fails after content exists

Behavior:

- if failure occurs before stream starts, return HTTP error
- if failure occurs after stream starts, emit terminal `error`
- if failure occurs after run creation, finalize run as failed when possible

## Stream Contract

The frontend contract remains NDJSON with the same event types:

- `stage`
- `text-delta`
- `message-complete`
- `error`

The backend adds stricter guarantees:

- `stage` may happen zero or more times
- `text-delta` may happen zero or more times
- exactly one terminal event must happen:
  - `message-complete`
  - `error`
- after terminal event, stream must close immediately

This allows the current frontend to remain compatible while removing ambiguous in-between states.

## Persistence Model Changes

This phase does not require a major schema rewrite, but it changes when existing records are written.

### Messages

- user message is inserted immediately after acceptance
- assistant message is inserted only when final fallback or final provider content exists

### Agent runs

- primary run is created before provider execution
- provider errors are stored as operational failure metadata
- limited fallback is still tied to the same primary run, but the run status remains `failed`

### Conversations

- `last_agent_run_at` should update whenever a primary run reaches terminal state
- conversation title may still be first-message derived, but user message persistence no longer depends on successful provider execution

## Error Classification

Failures should be classified into three groups:

### 1. User / request failures

- invalid input
- unauthorized
- conversation not found / not owned

These are request-level failures and should not create a run.

### 2. Pipeline failures

- cannot persist user message
- cannot create run
- cannot persist assistant message
- cannot finalize run

These indicate backend integrity problems and should surface loudly.

### 3. Provider operational failures

- quota exceeded
- timeout
- rate limit
- provider unavailable
- provider configuration missing

These should fall through `FallbackPolicyService` and be visible to the user and audit trail as operational failures, not generic product copy.

## Testing Strategy

### Unit tests

Add focused tests for:

- turn state transitions
- terminal stream guarantees
- fallback policy classification
- repository ordering invariants
- provider cooldown behavior

### Integration tests

Add server-side tests that simulate:

- successful streamed provider response
- provider quota failure with fallback completion
- assistant persistence failure after provider completion
- no duplicate terminal events

### Regression tests

Specific regressions to lock down:

- no more empty conversations after a started turn
- no more stage-only streams without terminal completion
- provider quota failures must persist operational reason

## Rollout Plan

### Phase 1A

Extract the pipeline and repositories while keeping current frontend contract unchanged.

### Phase 1B

Move fallback policy and run finalization completely out of `chat-router.ts`.

### Phase 1C

Delete the old monolithic path in `chat-router.ts` and make it a thin adapter or remove it entirely from the streamed flow.

## Risks

### Migration risk

Moving persistence earlier changes data ordering assumptions. Tests must lock down the new order.

### Compatibility risk

The frontend currently assumes its existing event protocol. The backend rewrite must preserve the protocol exactly during Phase 1.

### Partial rollout risk

If the new pipeline coexists with old helper logic for too long, we may create duplicate or conflicting behavior. The migration should be short and deliberate.

## Recommendation

Proceed with this as the first formal re-architecture phase.

Do not try to rebuild planner logic, memory, multi-provider routing, or long-term agent strategy until the turn pipeline has deterministic lifecycle semantics. Right now the pipeline itself is the unstable foundation, and everything above it inherits that instability.

# Aura Medical Runtime Design

## Summary

This document defines the first shippable version of Aura's new medical chat runtime.

The approved direction is:

- keep `app` as the product shell
- keep the existing auth, conversation persistence, and vault flows
- add a new opt-in runtime path that can coexist with the current Kimi chat flow
- make the new runtime feel like one product with two strong modes:
  - `personal-health`
  - `research`

This phase is not the final medical backend. It is the vertical slice that lets Aura ship the new interaction model now, while preserving a clean contract for a future external runtime service.

## Goals

- Add a new `aura-medical-v1` runtime path without breaking the current chat flow.
- Keep the existing Aura conversation history, vault ingestion, and stream protocol unchanged from the frontend's point of view.
- Introduce explicit runtime metadata for:
  - runtime version
  - medical mode
  - policy level
- Support two user-visible modes in the new runtime:
  - `personal-health`
  - `research`
- Apply a conservative default policy with opt-in interpretive behavior.
- Surface research evidence blocks in the chat metadata when the runtime uses search-oriented tool results.

## Non-Goals

- No full FastAPI/LangGraph service in this phase.
- No separate deployment unit yet.
- No full ingestion of hundreds of OpenClaw or AIPOCH skills.
- No database migration for a new conversation model.
- No attempt to replace every current agent/persona in one pass.

## Product Shape

Aura should feel like a single chat product with a runtime selector behind the scenes.

The current `KimiChat` experience stays in place, but the user can run:

- `classic`
- `aura-medical-v1`

When `aura-medical-v1` is selected, the chat also carries:

- `medicalMode`: `personal-health` or `research`
- `policyLevel`: `interpretive-on-request`

The user experience should communicate that:

- `personal-health` blends user vault context with evidence and biomarker interpretation
- `research` behaves more like an evidence assistant and is stricter about study quality and uncertainty
- both modes share the same memory, vault, and conversation history

## Architecture

### Shell remains in `app`

The existing app keeps ownership of:

- auth/session sync
- chat UI
- message persistence
- conversation URLs
- vault upload and preview
- NDJSON stream handling

### New runtime contract

The new runtime is introduced as a separate contract path inside the current backend:

- `POST /api/aura-medical/chat/stream`

This route keeps the same stream event protocol:

- `stage`
- `text-delta`
- `message-complete`
- `error`

That lets the frontend reuse the existing stream parser and rendering behavior.

### Runtime layering

The existing Kimi turn service remains the execution engine, but the new runtime adds a medical orchestration layer around it:

1. runtime selection
2. medical mode selection
3. policy prompt shaping
4. tool preference shaping
5. metadata enrichment
6. evidence extraction from tool results

This creates the right contract boundary now without forcing a full infrastructure split.

## OpenClaw and AIPOCH Influence

The implementation should borrow patterns, not bulk-import skills.

From OpenClaw:

- modular capability selection
- explicit biomedical search and trial lookup posture
- specialist-style response framing

From AIPOCH:

- evidence-first reasoning
- study-type awareness
- prioritization of higher-quality evidence
- critical appraisal and gap identification

In this phase, those ideas show up as runtime prompt policy and metadata behavior rather than a huge skill registry.

## Server Design

### Shared input contract

The chat send-message input gains optional runtime fields:

- `runtimeVersion`
- `medicalMode`
- `policyLevel`

The classic path ignores them.

### Aura medical context loader

A new context loader wraps the current Kimi context loader and augments it with:

- runtime-specific prompt instructions
- mode-specific tool preferences
- stage labels tailored to the medical runtime
- runtime metadata seeds for the assistant message

### Assistant metadata enrichment

The new runtime should persist richer assistant metadata including:

- `runtimeVersion`
- `medicalMode`
- `policyLevel`
- evidence blocks parsed from tool results where possible
- reasoning notes that indicate whether the turn was handled as research-first or personal-health-first

## Frontend Design

`KimiChat` gets lightweight runtime controls:

- runtime version selector
- mode selector
- policy badge/state

The frontend should choose the stream endpoint from the selected runtime version while preserving the existing message rendering and stream parsing pipeline.

## Testing

This phase needs focused tests for:

- runtime endpoint selection on the client
- medical runtime prompt/tool shaping on the server
- persisted metadata for the new runtime
- route exposure for the new stream endpoint

## Success Criteria

The new version is successful when:

- the user can switch into `aura-medical-v1`
- the chat continues to stream through the current UI
- `personal-health` and `research` modes produce different runtime instructions
- assistant messages persist runtime metadata
- evidence cards can render from parsed research results
- the classic runtime still works

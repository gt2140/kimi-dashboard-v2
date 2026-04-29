# Fast Agent Orchestration Design

**Goal:** Make chat responses feel significantly faster and more intentional by default while preserving the multi-agent foundation.

**Approved direction:** The generalist is the default fast-path responder. Supporting agents should only be consulted when the user explicitly invokes them in the message or when the generalist decides a specialist consult is worthwhile.

## Current problems

- Every turn can become heavier than necessary because supporting agents are treated as active participants rather than optional turn-level consultants.
- Prompts are large, repetitive, and mostly concatenated from raw text blocks.
- The assistant personality exists, but each agent lacks a stronger response contract and consultation policy.
- The frontend reflects a traditional request/response loop, which makes the waiting time feel worse.

## Target behavior

### Turn routing

- Start every turn with a fast-path policy.
- Determine explicit mentions from the user message.
- Determine optional specialist consults only when the primary agent is `generalist` and the message strongly matches a specialist domain.
- Cap automatic consults to a small number per turn.

### Prompting

- Build prompts from layers instead of one large blob:
  - identity and tone
  - domain scope
  - response style contract
  - consultation policy
- Keep specialist prompts concise and optimized for “consult the primary agent”, not “answer like a full standalone assistant”.

### Context

- Use a compact window of recent messages.
- Limit vault summaries to a few relevant file names per run.
- Keep user custom context and training notes, but only inject them when present.

### UX

- Make the primary answer the center of the experience.
- Show when specialists are assisting, but avoid making every turn feel like a committee process.
- Preserve manual “call agent” behavior while ensuring it does not automatically force a heavy orchestration path unless the user message or planner requires it.

## Technical approach

### Backend

- Add a pure consultation policy service that decides which supporting agents to consult for a turn.
- Add a pure prompt composer service that gives each agent stronger character and a clearer response contract.
- Refactor the chat router to use the consultation policy instead of blindly consulting all attached supporting agents.

### Frontend

- Clarify that called agents are available helpers, not guaranteed participants in every reply.
- Surface which agents were actually consulted in the assistant metadata.

## Success criteria

- Default turns use only the primary agent unless explicit mention or consultation policy says otherwise.
- Supporting consults become selective and traceable.
- Prompts become shorter and more opinionated.
- The chat feels faster because fewer turns fan out into multiple model calls.

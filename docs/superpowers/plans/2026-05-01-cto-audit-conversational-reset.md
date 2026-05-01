# CTO + AI/ML Chat Audit

## Mission

Restore the conversational product to the smallest possible working backend:

`authenticated request -> persist user message -> single model call -> persist assistant message -> return response`

Everything else is optional until this baseline is stable in production.

## Virtual Roles

### CTO Agent

Responsibility:
- protect product reliability
- reject backend complexity that does not increase user-visible success rate
- force a phased rebuild

Decision rule:
- if a feature makes the turn harder to debug, it does not belong in the active path yet

### AI/ML Chat Auditor

Responsibility:
- inspect every conversational dependency between UI and model response
- classify each layer as `required now`, `later`, or `remove`
- prioritize end-to-end functional delivery over orchestration quality

Decision rule:
- if a chat turn cannot be explained in one screen of text, it is too complex for the current phase

## Findings

### What broke the system

1. The conversational backend accumulated too many moving parts:
   - streaming transport
   - helper-agent orchestration
   - local memory persistence
   - vault retrieval
   - tool execution
   - run tracing and context block persistence

2. Failure domains were coupled:
   - a stream issue looked like a model issue
   - a provider issue looked like a frontend issue
   - agent/tool/memory layers made root-cause analysis slower

3. The product lost a safe baseline:
   - there was no permanently simple path that only answered one message with one model

## Keep / Remove / Later

### Keep now

- Kimi frontend UI
- persisted conversations
- persisted messages
- authenticated ownership checks
- single primary agent selection
- single Kimi model call

### Keep visually, disable logically

- helper agents in UI
  - for now they are prompt-level metadata only
  - they should not change backend orchestration

### Remove from active conversational path

- backend helper-agent execution
- tool execution in the chat turn
- local memory writeback during the turn
- vault chunk retrieval in the chat turn
- model gateway indirection
- agent runs and context block persistence
- streaming as the only delivery mechanism

### Reintroduce later, one by one

1. server streaming
2. vault retrieval
3. memory
4. helper-agent logic
5. tools

## New Baseline Architecture

### Phase 0

`KimiChat UI -> useKimiChatData -> /api/kimi/chat/respond -> KimiConversationTurnService -> Kimi API -> save assistant message -> refresh conversation`

Rules:
- one request
- one model
- one answer
- no tools
- no retrieval
- no orchestration

### Phase 1

Add observability only:
- turn start log
- provider request start/end
- database write success/failure
- per-turn latency

### Phase 2

Add optional streaming only after Phase 0 stays stable in preview and production.

## Action Plan

### Immediate

1. Make the frontend use the non-stream conversational path by default.
2. Keep the stream route out of the critical path.
3. Verify the preview can send one message and receive one persisted reply.

### Next

1. Add runtime logs around the minimal turn.
2. Measure success rate and latency in preview.
3. Only if stable, reintroduce streaming as a transport enhancement.

### Later

1. Restore vault as read-only context.
2. Restore memory as small, explicit summaries.
3. Restore helper agents as a controlled second pass, not as the default path.

## Non-Negotiable Principle

The conversational system must always keep one permanently boring path that works even when advanced features are off.

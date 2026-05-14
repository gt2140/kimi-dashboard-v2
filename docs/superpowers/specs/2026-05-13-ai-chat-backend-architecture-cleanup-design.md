# AI Chat Backend Architecture Cleanup Design

**Goal:** Simplify the chat backend around one provider-agnostic turn pipeline, prepare the migration to Vercel AI, and remove duplicated Kimi/Aura transition code without breaking the current chat experience.

**Current State:** The live chat flow is centered on `KimiConversationTurnService`, even when OpenAI or Venice is selected through `ModelGatewayService`. `/api/chat/stream`, `/api/kimi/chat/stream`, and `/api/aura-medical/chat/stream` all converge on the same Hono handler. The frontend has overlapping chat hooks, and several shared stream/stage utilities live under `src/lib` while being imported by server code.

**Target State:** Chat becomes a single product surface backed by a neutral turn runtime. Kimi, Venice, OpenAI, and future Vercel AI-backed models become provider adapters behind one execution contract. Runtime-specific naming stays only where it describes a real provider or a deliberate compatibility alias.

---

## Findings

### Backend Flow

The live HTTP and tRPC paths converge on `auraMedicalConversationTurnService.executeTurn`.

- `api/chat/stream.ts`, `api/kimi/chat/stream.ts`, and `api/aura-medical/chat/stream.ts` are thin wrappers around `server/http-app.ts`.
- `server/http-app.ts` parses the chat body, authenticates the request, emits NDJSON stream events, and delegates to `auraMedicalConversationTurnService`.
- `server/trpc/chat-router.ts` handles conversation CRUD and non-stream send, but also forces `runtimeVersion: "aura-medical-v1"`.
- `server/services/kimi-runtime.ts` wires two `KimiConversationTurnService` instances, but the Aura medical instance is the live path.
- `server/services/kimi-conversation-turn-service.ts` handles ownership checks, context loading, persistence, provider execution, tool execution, run finalization, memory persistence, and metadata construction.

### Provider Selection

Provider selection already exists, but only as a branch inside a Kimi-named runtime.

- If `requestedProviderSlug` is present, `KimiConversationTurnService` calls `ModelGatewayService`.
- If `requestedProviderSlug` is absent, it falls back to native Kimi with hardcoded `kimi-k2.6`.
- `ModelGatewayService` supports `openai` and `venice` directly through manual `fetch` calls.
- The older provider/model DB path in `conversation-turn-service.ts`, `chat-reply-builder.ts`, and `execution-target.ts` is cleaner conceptually, but does not appear to be the live entrypoint.

### Venice Integration Notes

Venice should be treated as an OpenAI-compatible chat-completions provider with provider-specific extensions.

- Base URL: `https://api.venice.ai/api/v1`.
- Chat endpoint: `/chat/completions`.
- Authentication: `Authorization: Bearer <VENICE_API_KEY>`.
- The backend accepts `VENICE_API_KEY` and `VENICE_INFERENCE_KEY`; the latter is an alias for keys created as inference keys.
- Venice supports extra `venice_parameters`, including web search, web scraping, prompt behavior, and thinking controls. These belong in provider-specific metadata/options, not in the core turn runtime.
- Venice response headers include request IDs, model metadata, rate limits, balance, and deprecation warnings. The future provider adapter should preserve request ID and warning metadata when available.
- For Vercel AI SDK, Venice recommends the OpenAI-compatible adapter via `createOpenAI({ baseURL: "https://api.venice.ai/api/v1" })` and `.chat(modelId)` so requests use `/chat/completions`.

### Duplication

The largest duplication and naming drift is in the transition layer.

- `src/hooks/useChatData.ts` and `src/hooks/useKimiChatData.ts` duplicate conversation loading, URL state, auth headers, stream parsing, retry handling, and invalidation behavior.
- `src/hooks/useChatData.ts` defines local message mappers already extracted into `src/hooks/kimi-chat-mappers.ts`.
- The three stream endpoints share one implementation but still present three product identities.
- Fallback behavior is spread across client retry logic, persisted-message recovery, and server-side limited replies.
- `chat-stream.ts` and `chat-experience.ts` are under frontend paths but are imported by backend code.

### Testing State

The tests are useful, but they still protect the transitional implementation more than the future architecture.

- `server/services/model-gateway.test.ts` covers parser and capability behavior, but needs deeper mocked provider request coverage.
- `server/services/kimi-conversation-turn-service.test.ts` covers the live service, including Venice override, but is tied to Kimi labels and metadata.
- `server/trpc/chat-router.test.ts` and `server/http-app.*.test.ts` cover route behavior, but need canonical provider-agnostic stream contract tests.
- `src/lib/chat-stream.test.ts` is a strong base for the NDJSON transport contract.
- `src/hooks/kimi-chat-recovery.test.ts` covers persisted recovery helpers, but not the complete stream failure recovery flow.

---

## Design Principles

1. One chat product surface.

`chat`, `kimi`, and `aura-medical` should stop being competing mental models. The canonical product surface is chat. Kimi and Aura Medical can remain as provider/runtime names only where they describe actual behavior.

2. One turn runtime contract.

The backend should expose one neutral turn execution contract. The contract owns context assembly, provider execution, persistence, metadata, and stream events through explicit dependencies.

3. Provider adapters behind one gateway.

OpenAI, Venice, Kimi, and Vercel AI should be interchangeable from the turn runtime's point of view. Provider-specific request shape, stream parsing, tool support, and model defaults belong in adapters.

4. Compatibility aliases stay thin.

Legacy routes can remain temporarily, but they should be documented as aliases to the canonical route and tested only as compatibility smoke coverage.

5. Shared contracts live in shared locations.

Stream event DTOs, stage definitions, and transport parsers should move out of `src/lib` into a neutral shared module before deeper backend refactors depend on them.

---

## Target Architecture

### Modules

`server/chat`

Owns conversation routing, stream endpoints, request validation, auth integration, and response transport.

`server/turn-runtime`

Owns turn orchestration: load context, create user message, create run, execute model, persist assistant message, write context blocks, finalize run, and return a normalized result.

`server/ai-providers`

Owns provider adapters and model execution. Vercel AI becomes the preferred implementation layer here. Manual Venice/OpenAI calls can remain behind the same interface until replaced.

`server/context`

Owns provider-neutral turn context assembly. Kimi memory, Aura medical additions, vault excerpts, clinical profile, and stage labels become named context contributors.

`contracts/chat`

Owns shared stream event shapes, runtime options, model selection types, and metadata contracts used by server and frontend.

`src/chat`

Owns frontend hooks, stream client, persisted recovery, and UI adapters.

### Core Interfaces

```ts
export type ChatModelSelection = {
  providerSlug: "auto" | "openai" | "venice" | "kimi";
  modelName?: string | null;
};

export type AiProviderRequest = {
  model: ChatModelSelection;
  systemPrompt: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  stream: boolean;
  signal?: AbortSignal;
  onTextDelta?: (delta: string) => void | Promise<void>;
};

export type AiProviderResult = {
  text: string;
  providerSlug: string;
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
  providerRequestId?: string | null;
  finishReason?: string | null;
  rawUsage?: Record<string, unknown>;
};
```

```ts
export type ConversationTurnRuntime = {
  executeTurn(input: {
    userId: number;
    conversationId: number;
    content: string;
    agentId: string;
    calledAgentIds: string[];
    runtimeOptions: AuraRuntimeOptions;
    modelSelection: ChatModelSelection;
    stream: boolean;
    onStage?: (stage: { id: string; label: string }) => void | Promise<void>;
    onTextDelta?: (delta: string) => void | Promise<void>;
  }): Promise<{
    success: true;
    assistantMessage: {
      id: number;
      role: "assistant";
      content: string;
      agentId: string;
      createdAt: Date;
      metadata: ChatAssistantMetadata;
    };
  }>;
};
```

### Metadata Contract

Assistant message metadata should expose a stable, provider-neutral core.

```ts
export type ChatAssistantMetadata = {
  engine: "aura-chat-v1";
  providerSlug: string;
  modelName: string;
  requestedProviderSlug?: string;
  requestedModelName?: string;
  runtimeVersion: "aura-medical-v1";
  medicalMode: "personal-health" | "research";
  policyLevel: "interpretive-on-request";
  responseMode: "model" | "limited";
  relatedVaultFiles?: string[];
  contextSummary?: string;
  inputTokens?: number;
  outputTokens?: number;
  executionNotes?: string[];
  fallbackReason?: string;
};
```

Provider-specific fields such as Kimi prompt cache keys, thinking mode, tool calls, and raw usage can be nested under `providerMetadata` instead of living at the top level.

---

## Migration Strategy

### Phase 0: Stabilize The Contract

Add tests around the current live behavior before renaming or extracting modules.

- Canonical stream emits `ack`, `stage`, `text-delta`, and `message-complete`.
- Explicit Venice/OpenAI selection persists normalized metadata.
- Auto/default selection still preserves current Kimi behavior until the Vercel AI path is ready.
- Stream failure can recover from a persisted assistant message.

### Phase 1: Remove Frontend Duplication

Create a shared chat stream client and consolidate conversation hook behavior.

- Extract shared conversation mappers.
- Extract auth-header and stream-open logic.
- Keep the current page API stable.
- Mark legacy hook usage clearly or remove it if unused.

### Phase 2: Introduce Provider-Neutral Runtime

Wrap current `KimiConversationTurnService` behavior behind a neutral runtime contract, then move pieces out gradually.

- Extract provider execution into an `AiProviderGateway`.
- Extract metadata builder.
- Extract persistence/finalization steps.
- Keep current Kimi native fallback behavior while the new provider gateway is tested.

### Phase 3: Move To Vercel AI

Replace manual provider calls with Vercel AI-backed adapters.

- Add Vercel AI dependency and provider adapter in a narrow module.
- Implement Venice through the OpenAI-compatible Vercel AI SDK provider with `baseURL: "https://api.venice.ai/api/v1"` and `.chat(modelId)`.
- Route Venice/OpenAI/Kimi model selection through the new adapter.
- Preserve existing NDJSON response contract unless the frontend migrates at the same time.
- Add provider capability handling for tools, streaming, reasoning, and model defaults.

### Phase 4: Retire Transition Code

Remove names and aliases that no longer represent live architecture.

- Remove or freeze `/api/kimi/chat/stream`.
- Rename Kimi-specific hooks and frontend libs.
- Delete unused `kimiConversationTurnService` instance if still unused.
- Move shared stream/stage DTOs out of `src/lib`.

---

## Risks

- Tool behavior is strongly tied to Kimi/Moonshot today. Tool migration should be isolated from the first provider execution migration.
- Message metadata is already consumed by UI, tests, and analytics-like traces. A compatibility mapper may be needed during transition.
- Vercel AI stream semantics may not match the current NDJSON contract directly. The first implementation should adapt Vercel AI output into the existing client contract.
- Some tests intentionally protect legacy Kimi aliases. They should be retained as smoke tests until route deprecation is explicit.

---

## Success Criteria

- There is one canonical chat stream endpoint and one documented compatibility story for old aliases.
- Provider/model selection works through one gateway path.
- The live runtime no longer needs to be named after Kimi to execute OpenAI, Venice, or Vercel AI-backed models.
- Frontend chat state and stream parsing live in one shared client path.
- Tests protect the product contract rather than Kimi-specific implementation details.

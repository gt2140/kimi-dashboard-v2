# Aura Core Cleanup Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Aura's active code path cleaner and faster to work on by fixing active lint issues, extracting backend route modules, and tightening low-risk client query/loading behavior.

**Architecture:** Keep existing routes and product behavior intact. Turn `server/http-app.ts` into a route composition file by moving chat and vault HTTP route registration into owned modules, then make small active-file frontend/backend cleanup changes that reduce render churn and lint debt.

**Tech Stack:** React 19, Vite, Hono, tRPC, TanStack Query, Supabase Auth, Drizzle, TypeScript, Vitest, ESLint.

---

## File Structure

- Create `server/chat/chat-routes.ts`
  - Owns chat HTTP route registration for `/api/chat/stream`, `/api/chat/send`, `/api/chat/provider-check`, and `/api/chat/diagnose-turn`.
  - Exports `registerChatRoutes(app)` and `shouldStreamProviderDirectlyInRoutes()`.
- Create `server/vault/vault-routes.ts`
  - Owns all `/api/vault/documents*` HTTP routes.
  - Exports `registerVaultRoutes(app)`.
- Modify `server/http-app.ts`
  - Keeps app creation, tRPC registration, route registration calls, and final `/api/*` 404 only.
- Modify `server/services/venice-chat-runtime.ts`
  - Remove useless catch and align formatting around recent messages fallback.
- Modify `server/services/model-gateway.ts`
  - Avoid unused variable lint in `getDefaultModel`.
- Modify `server/trpc/chat-router.ts`
  - Make metadata schema type usage explicit enough for lint.
- Modify `src/pages/KimiVault.tsx`
  - Stabilize document array memo inputs and preview category draft update.
- Modify `src/providers/trpc-client.ts`
  - Add query defaults for repeated product queries.
- Modify `src/pages/Login.tsx`
  - Move landing URL into shared config if already available, otherwise keep local but name it as an app config constant.
- Test existing focused route and chat tests.

---

### Task 1: Baseline And Active Lint Cleanup

**Files:**
- Modify: `server/services/venice-chat-runtime.ts`
- Modify: `server/services/model-gateway.ts`
- Modify: `server/trpc/chat-router.ts`
- Modify: `src/pages/KimiVault.tsx`

- [ ] **Step 1: Run baseline checks**

Run:

```bash
npm run check
npm run lint
```

Expected:

- `npm run check` passes.
- `npm run lint` is currently red. Capture the active-file errors before changing code.

- [ ] **Step 2: Remove useless catch in Venice runtime**

In `server/services/venice-chat-runtime.ts`, replace:

```ts
    try {
      const turnContext = await this.loadTurnContext(input).catch(error => {
```

through the matching:

```ts
    } catch (error) {
      throw error;
    }
```

with:

```ts
    const turnContext = await this.loadTurnContext(input).catch(error => {
      logServerDebug("chat.turn.venice.context-fallback", {
        conversationId: input.conversationId,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Context loader failed unexpectedly.",
      });
      return null;
    });
    const recentMessages = turnContext
      ? turnContext.recentMessages.map(message => ({
          role: message.role,
          content: message.content,
        }))
      : await this.loadRecentMessages({
          conversationId: input.conversationId,
          limit: 6,
        });
    const systemPrompt = buildVeniceSystemPrompt({
      conversationSummary:
        turnContext?.conversationSummary ?? conversation.summary ?? null,
      context: turnContext,
    });

    await input.onStage?.({
      id: "draft",
      label: input.stream
        ? "Streaming Venice response"
        : "Writing Venice response",
    });

    const requestedModelName = input.requestedModelName?.trim() || null;
    const modelResult = input.stream
      ? await this.modelGateway.streamText({
          providerSlug: "venice",
          modelName: requestedModelName,
          systemPrompt,
          messages: recentMessages,
          signal: input.signal,
          onTextDelta: input.onTextDelta,
        })
      : await this.modelGateway.generateText({
          providerSlug: "venice",
          modelName: requestedModelName,
          systemPrompt,
          messages: recentMessages,
          signal: input.signal,
        });
```

Keep the assistant metadata and persistence block immediately after this code.

- [ ] **Step 3: Fix unused provider arg in model gateway**

In `server/services/model-gateway.ts`, replace:

```ts
  getDefaultModel(_providerSlug: LiveProviderSlug = "venice") {
    return env.veniceModel || SAFE_VENICE_FALLBACK_MODEL;
  }
```

with:

```ts
  getDefaultModel() {
    return env.veniceModel || SAFE_VENICE_FALLBACK_MODEL;
  }
```

Then update calls like:

```ts
this.getDefaultModel("venice")
```

to:

```ts
this.getDefaultModel()
```

- [ ] **Step 4: Make chat metadata schema type-only lint-safe**

In `server/trpc/chat-router.ts`, change:

```ts
const chatMetadataSchema = z
```

to:

```ts
const chatMetadataSchema = z
```

and add after the schema:

```ts
type ParsedChatMetadata = z.infer<typeof chatMetadataSchema>;
```

Then change:

```ts
return JSON.parse(metadata) as z.infer<typeof chatMetadataSchema>;
```

to:

```ts
return JSON.parse(metadata) as ParsedChatMetadata;
```

- [ ] **Step 5: Stabilize Vault documents and preview draft**

In `src/pages/KimiVault.tsx`, replace:

```ts
  const documents = documentsQuery.data ?? [];
```

with:

```ts
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
```

Replace the preview category effect:

```ts
  useEffect(() => {
    setPreviewCategoryDraft(previewDocument?.category ?? "other");
  }, [previewDocument?.id, previewDocument?.category]);
```

with a guarded update:

```ts
  useEffect(() => {
    const nextCategory = previewDocument?.category ?? "other";
    setPreviewCategoryDraft(current =>
      current === nextCategory ? current : nextCategory,
    );
  }, [previewDocument?.id, previewDocument?.category]);
```

- [ ] **Step 6: Run focused checks**

Run:

```bash
npm run check
npx eslint server/services/venice-chat-runtime.ts server/services/model-gateway.ts server/trpc/chat-router.ts src/pages/KimiVault.tsx
```

Expected:

- TypeScript passes.
- Focused ESLint has fewer active-file errors. If React compiler still flags the guarded state effect, defer the preview draft initialization to the preview open handler in Task 4.

- [ ] **Step 7: Commit**

```bash
git add server/services/venice-chat-runtime.ts server/services/model-gateway.ts server/trpc/chat-router.ts src/pages/KimiVault.tsx
git commit -m "fix: reduce active aura cleanup lint debt"
```

---

### Task 2: Extract Chat HTTP Routes

**Files:**
- Create: `server/chat/chat-routes.ts`
- Modify: `server/http-app.ts`
- Test: `server/http-app.production.test.ts`
- Test: `server/http-app.kimi-routes.test.ts`
- Test: `server/chat/simple-chat-handler.test.ts`
- Test: `server/chat/provider-check-handler.test.ts`
- Test: `server/chat/diagnose-turn-handler.test.ts`

- [ ] **Step 1: Create chat route module**

Create `server/chat/chat-routes.ts` with:

```ts
import { stream } from "hono/streaming";
import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { authenticateRequest } from "../trpc/auth.js";
import { chatSendMessageInputSchema } from "../trpc/chat-router.js";
import { TurnStreamController } from "../services/turn-stream-controller.js";
import { withAbortableTimeout } from "../services/async-guard.js";
import { auraChatConversationTurnRuntime } from "../services/venice-chat-runtime.js";
import { classifyApiError } from "../lib/api-errors.js";
import { logServerDebug } from "../lib/debug.js";
import { handleSimpleChatRequest } from "./simple-chat-handler.js";
import { handleProviderCheckRequest } from "./provider-check-handler.js";
import { handleDiagnoseTurnRequest } from "./diagnose-turn-handler.js";

const CHAT_ROUTE_TIMEOUT_MS = 180_000;
const SHOULD_STREAM_PROVIDER_DIRECTLY = true;

type App = Hono<{ Bindings: HttpBindings }>;
type HonoContext = Parameters<Parameters<App["post"]>[1]>[0];

export function shouldStreamProviderDirectlyInRoutes() {
  return SHOULD_STREAM_PROVIDER_DIRECTLY;
}

function createNdjsonStreamResponse(
  c: HonoContext,
  run: (
    streamController: TurnStreamController,
    signal: AbortSignal,
  ) => Promise<void>,
  details: {
    requestId: string;
    route: string;
    conversationId: number;
    userId: number;
    agentId: string;
  },
  label = "Chat stream",
) {
  c.header("Content-Type", "application/x-ndjson; charset=utf-8");
  c.header("Cache-Control", "no-cache, no-transform");
  c.header("Connection", "keep-alive");
  c.header("X-Accel-Buffering", "no");

  let streamController: TurnStreamController | null = null;
  let firstChunkSent = false;
  const clientAbortController = new AbortController();

  return stream(
    c,
    async honoStream => {
      honoStream.onAbort(() => {
        logServerDebug("chat.turn.stream.aborted", {
          ...details,
          firstChunkSent,
        });
        clientAbortController.abort(
          new Error("Client disconnected while streaming chat."),
        );
        streamController?.disconnect();
      });

      streamController = new TurnStreamController({
        write: async payload => {
          if (!firstChunkSent) {
            firstChunkSent = true;
            logServerDebug("chat.turn.stream.first-chunk", {
              ...details,
              payloadBytes: payload.length,
            });
          }

          await honoStream.write(payload);
        },
        close: async () => {
          logServerDebug("chat.turn.stream.close", {
            ...details,
            firstChunkSent,
          });
          await honoStream.close();
        },
      });

      try {
        const activeStreamController = streamController;
        if (!activeStreamController) {
          throw new Error("Chat stream controller was not initialized.");
        }

        await withAbortableTimeout(
          signal => run(activeStreamController, signal),
          {
            label,
            timeoutMs: CHAT_ROUTE_TIMEOUT_MS,
            signal: clientAbortController.signal,
          },
        );
      } catch (error) {
        const failure = classifyApiError(error);
        await streamController.fail(failure);
      }
    },
    async (error, honoStream) => {
      logServerDebug("chat.turn.stream.error", {
        ...details,
        firstChunkSent,
        error: error.message,
      });
      await honoStream.write(
        `${JSON.stringify({
          type: "error",
          message: error.message,
          category: classifyApiError(error).category,
          traceId: details.requestId,
        })}\n`,
      );
    },
  );
}

async function handleChatStreamRoute(c: HonoContext) {
  const route = "/api/chat/stream";
  const authStartedAt = Date.now();
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = chatSendMessageInputSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: "Invalid request body.",
        details: parsed.error.flatten(),
      },
      400,
    );
  }

  const requestId = globalThis.crypto.randomUUID().slice(0, 8);
  c.header("X-Trace-Id", requestId);
  return createNdjsonStreamResponse(
    c,
    async (streamController, signal) => {
      await streamController.emitAck({ traceId: requestId });
      logServerDebug("chat.turn.route.start", {
        requestId,
        route,
        conversationId: parsed.data.conversationId,
        agentId: parsed.data.agentId,
        userId: user.id,
        authMs: Date.now() - authStartedAt,
      });
      await streamController.emitStage({
        id: "memory",
        label: "Loading chat context",
      });
      const result = await auraChatConversationTurnRuntime.executeTurn({
        userId: user.id,
        conversationId: parsed.data.conversationId,
        content: parsed.data.content,
        agentId: parsed.data.agentId,
        requestedModelName: parsed.data.requestedModelName,
        stream: shouldStreamProviderDirectlyInRoutes(),
        signal,
        onStage: async stage => {
          await streamController.emitStage(stage);
        },
        onTextDelta: async delta => {
          await streamController.emitDelta(delta);
        },
      });

      await streamController.complete({
        id: String(result.assistantMessage.id),
        role: "assistant",
        content: result.assistantMessage.content,
        agentId: result.assistantMessage.agentId,
        createdAt: result.assistantMessage.createdAt.toISOString(),
        metadata: result.assistantMessage.metadata,
      });
    },
    {
      requestId,
      route,
      conversationId: parsed.data.conversationId,
      userId: user.id,
      agentId: parsed.data.agentId,
    },
    "Aura chat turn",
  );
}

export function registerChatRoutes(app: App) {
  app.post("/api/chat/stream", async c => {
    return handleChatStreamRoute(c);
  });

  app.post("/api/chat/send", async c => {
    return handleSimpleChatRequest(c.req.raw);
  });

  app.on(["GET", "POST"], "/api/chat/provider-check", async c => {
    return handleProviderCheckRequest(c.req.raw);
  });

  app.post("/api/chat/diagnose-turn", async c => {
    return handleDiagnoseTurnRequest(c.req.raw);
  });
}
```

- [ ] **Step 2: Wire chat routes from http app**

In `server/http-app.ts`, remove the chat route helper code and imports that moved to `server/chat/chat-routes.ts`.

Add:

```ts
import { registerChatRoutes } from "./chat/chat-routes.js";
```

Then call:

```ts
registerChatRoutes(app);
```

after the tRPC middleware registration and before vault route registration.

- [ ] **Step 3: Run focused chat route tests**

Run:

```bash
npx vitest run server/http-app.production.test.ts server/http-app.kimi-routes.test.ts server/chat/simple-chat-handler.test.ts server/chat/provider-check-handler.test.ts server/chat/diagnose-turn-handler.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 4: Run TypeScript**

Run:

```bash
npm run check
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/chat/chat-routes.ts server/http-app.ts
git commit -m "refactor: isolate aura chat http routes"
```

---

### Task 3: Extract Vault HTTP Routes

**Files:**
- Create: `server/vault/vault-routes.ts`
- Modify: `server/http-app.ts`
- Test: `server/services/vault-v2-service.test.ts`
- Test: `server/services/vault-v2.test.ts`
- Test: route coverage through existing HTTP app tests if present

- [ ] **Step 1: Create vault route module**

Create `server/vault/vault-routes.ts` by moving every `/api/vault/documents*` route body from `server/http-app.ts`.

The module must export:

```ts
import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { authenticateRequest } from "../trpc/auth.js";
import { logServerDebug } from "../lib/debug.js";
import { vaultV2Service } from "../services/vault-v2-service.js";

type App = Hono<{ Bindings: HttpBindings }>;

function ensureVaultWorkerStarted() {
  vaultV2Service.startWorker();
}

function normalizeVaultCategory(value: string) {
  switch (value) {
    case "bloodwork":
    case "genetics":
    case "wearables":
    case "body-composition":
    case "notes":
      return value;
    default:
      return "other" as const;
  }
}

export function registerVaultRoutes(app: App) {
  app.post("/api/vault/documents", async c => {
    ensureVaultWorkerStarted();
    let user: Awaited<ReturnType<typeof authenticateRequest>>;

    try {
      user = await authenticateRequest(c.req.raw.headers);
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const formData = await c.req.formData().catch(() => null);
    const file = formData?.get("file");
    const category = formData?.get("category");

    if (!(file instanceof File) || typeof category !== "string") {
      return c.json({ error: "file and category are required." }, 400);
    }

    try {
      logServerDebug("vault-v2.upload.start", {
        userId: user.id,
        filename: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        category,
      });
      const arrayBuffer = await file.arrayBuffer();
      const created = await vaultV2Service.createDocument({
        userId: user.id,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        category: normalizeVaultCategory(category),
        bytes: new Uint8Array(arrayBuffer),
      });
      logServerDebug("vault-v2.upload.success", {
        userId: user.id,
        vaultDocumentId: created.document.id,
        filename: file.name,
      });

      return c.json(created, 201);
    } catch (error) {
      logServerDebug("vault-v2.upload.failed", {
        userId: user.id,
        filename: file.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Vault upload failed unexpectedly.",
        },
        500,
      );
    }
  });

  app.get("/api/vault/documents", async c => {
    ensureVaultWorkerStarted();
    let user: Awaited<ReturnType<typeof authenticateRequest>>;

    try {
      user = await authenticateRequest(c.req.raw.headers);
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    try {
      const documents = await vaultV2Service.listDocuments(user.id);
      return c.json({ documents });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Vault V2 list failed unexpectedly.",
        },
        500,
      );
    }
  });

  app.get("/api/vault/documents/:id", async c => {
    ensureVaultWorkerStarted();
    let user: Awaited<ReturnType<typeof authenticateRequest>>;

    try {
      user = await authenticateRequest(c.req.raw.headers);
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const documentId = Number(c.req.param("id"));
    if (!Number.isFinite(documentId) || documentId <= 0) {
      return c.json({ error: "Invalid document id." }, 400);
    }

    try {
      const document = await vaultV2Service.getDocument(user.id, documentId);
      return c.json({ document });
    } catch (error) {
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Vault V2 document load failed unexpectedly.",
        },
        404,
      );
    }
  });
}
```

Then continue moving the remaining existing vault routes from `server/http-app.ts` into the same `registerVaultRoutes` function:

- `GET /api/vault/documents/:id/events`
- `GET /api/vault/documents/:id/original`
- `POST /api/vault/documents/:id/reprocess`
- `POST /api/vault/documents/:id/reclassify`
- `DELETE /api/vault/documents/:id`

Do not change response shapes.

- [ ] **Step 2: Wire vault routes from http app**

In `server/http-app.ts`, add:

```ts
import { registerVaultRoutes } from "./vault/vault-routes.js";
```

Then call:

```ts
registerVaultRoutes(app);
```

after `registerChatRoutes(app)` and before:

```ts
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));
```

- [ ] **Step 3: Run focused vault tests**

Run:

```bash
npx vitest run server/services/vault-v2-service.test.ts server/services/vault-v2.test.ts
```

Expected: pass.

- [ ] **Step 4: Run TypeScript**

Run:

```bash
npm run check
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add server/vault/vault-routes.ts server/http-app.ts
git commit -m "refactor: isolate vault http routes"
```

---

### Task 4: Query Defaults And Low-Risk UX Tightening

**Files:**
- Modify: `src/providers/trpc-client.ts`
- Modify: `src/pages/Login.tsx`
- Modify: `src/pages/KimiVault.tsx`

- [ ] **Step 1: Add query defaults for product data**

In `src/providers/trpc-client.ts`, replace:

```ts
export const queryClient = new QueryClient();
```

with:

```ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});
```

This reduces repeated refetches while keeping explicit invalidations intact.

- [ ] **Step 2: Make login landing URL an app config constant**

In `src/pages/Login.tsx`, replace:

```ts
const AURA_LANDING_URL = "https://landing-aura-v1-3hah.vercel.app";
```

with:

```ts
const AURA_LANDING_URL =
  import.meta.env.VITE_AURA_LANDING_URL ||
  "https://landing-aura-v1-3hah.vercel.app";
```

This preserves current behavior and allows production to configure the landing URL.

- [ ] **Step 3: If preview draft lint remains, move draft initialization to open handler**

If ESLint still flags `setPreviewCategoryDraft` in an effect, add:

```ts
  function openPreview(document: VaultDocument) {
    setPreviewCategoryDraft(document.category);
    setPreviewDocument(document);
  }
```

Then replace every:

```ts
setPreviewDocument(document)
```

with:

```ts
openPreview(document)
```

and delete the preview category effect.

- [ ] **Step 4: Run checks**

Run:

```bash
npm run check
npx eslint src/providers/trpc-client.ts src/pages/Login.tsx src/pages/KimiVault.tsx
```

Expected: pass for these files or only report pre-existing shadcn/Fast Refresh issues outside the touched files.

- [ ] **Step 5: Commit**

```bash
git add src/providers/trpc-client.ts src/pages/Login.tsx src/pages/KimiVault.tsx
git commit -m "perf: reduce repeated aura client refetches"
```

---

### Task 5: Final Verification And Report

**Files:**
- No required code edits.

- [ ] **Step 1: Run full TypeScript**

Run:

```bash
npm run check
```

Expected: pass.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npx vitest run server/http-app.production.test.ts server/http-app.kimi-routes.test.ts server/chat/simple-chat-handler.test.ts server/chat/provider-check-handler.test.ts server/chat/diagnose-turn-handler.test.ts server/services/vault-v2-service.test.ts server/services/vault-v2.test.ts
```

Expected: pass.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected:

- If full lint passes, report it.
- If full lint remains red due legacy files or shadcn generated UI exports, report exact remaining categories and confirm touched active files do not add new lint debt.

- [ ] **Step 4: Final commit if verification files changed**

If only code commits already exist, skip this step. If plan checkboxes or docs were updated during execution:

```bash
git add docs/superpowers/plans/2026-05-16-aura-core-cleanup-phase-1.md
git commit -m "docs: track aura cleanup phase 1 execution"
```

---

## Self-Review

- Spec coverage: This phase covers active lint cleanup, backend route boundary cleanup, query-level perceived speed, and login config tightening. It intentionally defers large Chat/Vault component extraction to a later phase because route extraction plus lint cleanup is independently testable.
- Placeholder scan: No TBD/TODO placeholders are present.
- Type consistency: Route registration functions use Hono with `HttpBindings`, existing handler names, and existing request/response shapes. The plan preserves `/kimi/*` UI routes and active `/api/chat/send` behavior.

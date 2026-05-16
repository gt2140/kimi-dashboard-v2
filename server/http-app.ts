import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { authenticateRequest } from "./trpc/auth.js";
import { logServerDebug } from "./lib/debug.js";
import { vaultV2Service } from "./services/vault-v2-service.js";
import { registerChatRoutes } from "./chat/chat-routes.js";

export { shouldStreamProviderDirectlyInRoutes } from "./chat/chat-routes.js";

export const app = new Hono<{ Bindings: HttpBindings }>();

function ensureVaultWorkerStarted() {
  vaultV2Service.startWorker();
}

app.use("/api/trpc/*", async c => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

registerChatRoutes(app);

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
      500
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
      500
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
      404
    );
  }
});
app.get("/api/vault/documents/:id/events", async c => {
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
    const events = await vaultV2Service.getDocumentEvents(user.id, documentId);
    return c.json({ events });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 events failed unexpectedly.",
      },
      404
    );
  }
});
app.get("/api/vault/documents/:id/original", async c => {
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
    const original = await vaultV2Service.readDocumentOriginal(
      user.id,
      documentId
    );

    return new Response(original.bytes, {
      headers: {
        "content-type": original.contentType,
        "content-disposition": `inline; filename="${document.filename}"`,
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 preview failed unexpectedly.",
      },
      404
    );
  }
});
app.post("/api/vault/documents/:id/reprocess", async c => {
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
    const result = await vaultV2Service.reprocessDocument(user.id, documentId);
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 reprocess failed unexpectedly.",
      },
      404
    );
  }
});
app.post("/api/vault/documents/:id/reclassify", async c => {
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

  const body = await c.req.json().catch(() => null);
  const category =
    body && typeof body.category === "string"
      ? normalizeVaultCategory(body.category)
      : null;

  if (!category) {
    return c.json({ error: "A valid category is required." }, 400);
  }

  try {
    const result = await vaultV2Service.reclassifyDocument({
      userId: user.id,
      documentId,
      category,
      reprocess: body?.reprocess !== false,
    });
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 reclassify failed unexpectedly.",
      },
      404
    );
  }
});
app.delete("/api/vault/documents/:id", async c => {
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
    const result = await vaultV2Service.deleteDocument(user.id, documentId);
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault V2 delete failed unexpectedly.",
      },
      404
    );
  }
});
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));

export default app;

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

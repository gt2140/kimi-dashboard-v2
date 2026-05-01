import { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { authenticateRequest } from "./trpc/auth.js";
import { chatSendMessageInputSchema } from "./trpc/chat-router.js";
import { and, eq } from "drizzle-orm";
import { vaultFiles } from "../db/schema.js";
import { TurnStreamController } from "./services/turn-stream-controller.js";
import { kimiConversationTurnService } from "./services/kimi-runtime.js";
import { ingestKimiVaultFile } from "./services/kimi-vault-ingestion.js";
import { getDb } from "./queries/connection.js";
import { readOriginalVaultFile } from "./services/vault-original-file.js";

export const app = new Hono<{ Bindings: HttpBindings }>();
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.post("/api/kimi/chat/stream", async (c) => {
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const streamController = new TurnStreamController({
        write: payload => {
          controller.enqueue(encoder.encode(payload));
        },
        close: () => {
          controller.close();
        },
      });

      void (async () => {
        try {
          const result = await kimiConversationTurnService.executeTurn({
            input: parsed.data,
            userId: user.id,
            streamPrimary: true,
            onStage: async stage => {
              streamController.emitStage(stage);
            },
            onTextDelta: async delta => {
              streamController.emitDelta(delta);
            },
          });

          if (!result.assistantMessage) {
            streamController.fail(
              "Kimi V1 finished without a persisted assistant message.",
            );
            return;
          }

          streamController.complete({
            id: String(result.assistantMessage.id),
            role: "assistant",
            content: result.assistantMessage.content,
            agentId: result.assistantMessage.agentId,
            createdAt: result.assistantMessage.createdAt.toISOString(),
            metadata: result.assistantMessage.metadata,
          });
        } catch (error) {
          streamController.fail(
            error instanceof Error
              ? error.message
              : "Kimi V1 streaming failed unexpectedly.",
          );
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
app.post("/api/kimi/vault/upload", async c => {
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
    const arrayBuffer = await file.arrayBuffer();
    const uploaded = await ingestKimiVaultFile({
      headers: c.req.raw.headers,
      userId: user.id,
      filename: file.name,
      fileType: inferFileType(file.name),
      category: normalizeVaultCategory(category),
      contentType: file.type || "application/octet-stream",
      bytes: new Uint8Array(arrayBuffer),
    });

    return c.json({ file: uploaded });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Kimi vault upload failed unexpectedly.",
      },
      500,
    );
  }
});
app.get("/api/kimi/vault/file/:id", async c => {
  let user: Awaited<ReturnType<typeof authenticateRequest>>;

  try {
    user = await authenticateRequest(c.req.raw.headers);
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const fileId = Number(c.req.param("id"));
  if (!Number.isFinite(fileId) || fileId <= 0) {
    return c.json({ error: "Invalid file id." }, 400);
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(vaultFiles)
    .where(and(eq(vaultFiles.id, fileId), eq(vaultFiles.userId, user.id)))
    .limit(1);

  const file = rows[0];
  if (!file) {
    return c.json({ error: "File not found." }, 404);
  }

  if (!file.encryptedUrl) {
    return c.json({ error: "Original file preview is not available yet." }, 404);
  }

  try {
    const original = await readOriginalVaultFile({
      headers: c.req.raw.headers,
      reference: file.encryptedUrl,
    });

    return new Response(original.bytes, {
      headers: {
        "content-type": original.contentType,
        "content-disposition": `inline; filename="${file.filename}"`,
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Vault preview failed unexpectedly.",
      },
      500,
    );
  }
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

function inferFileType(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext ? ext.toUpperCase() : "FILE";
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

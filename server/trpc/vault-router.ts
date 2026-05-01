import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { vaultFiles } from "../../db/schema.js";
import { KimiApiClient } from "../kimi/api-client.js";
import { createRouter, authedQuery } from "./middleware.js";
import { getDb } from "../queries/connection.js";
import { deleteOriginalVaultFile } from "../services/vault-original-file.js";

const vaultCategorySchema = z.enum([
  "bloodwork",
  "genetics",
  "wearables",
  "body-composition",
  "notes",
  "other",
]);

const vaultStatusSchema = z.enum(["ready", "processing", "failed"]);
const kimiClient = new KimiApiClient();

export const vaultRouter = createRouter({
  list: authedQuery
    .input(
      z
        .object({
          category: vaultCategorySchema.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const filters = [eq(vaultFiles.userId, ctx.user.id)];

      if (input?.category) {
        filters.push(eq(vaultFiles.category, input.category));
      }

      return db
        .select()
        .from(vaultFiles)
        .where(and(...filters))
        .orderBy(desc(vaultFiles.uploadedAt));
    }),

  upload: authedQuery
    .input(
      z.object({
        filename: z.string().min(1),
        fileType: z.string().min(1),
        category: vaultCategorySchema,
        size: z.number().int().nonnegative(),
        status: vaultStatusSchema.default("ready"),
        encryptedUrl: z.string().optional(),
        iv: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db
        .insert(vaultFiles)
        .values({
          userId: ctx.user.id,
          filename: input.filename,
          fileType: input.fileType,
          category: input.category,
          size: input.size,
          status: input.status,
          encryptedUrl: input.encryptedUrl,
          iv: input.iv,
          updatedAt: new Date(),
        })
        .returning({ id: vaultFiles.id });

      return { id: result[0].id };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const file = await db
        .select()
        .from(vaultFiles)
        .where(
          and(eq(vaultFiles.id, input.id), eq(vaultFiles.userId, ctx.user.id))
        )
        .limit(1);

      if (!file[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "File not found.",
        });
      }

      if (file[0].remoteFileId) {
        try {
          await kimiClient.deleteFile(file[0].remoteFileId);
        } catch {
          // Continue with local cleanup even if the remote file is already gone.
        }
      }

      await deleteOriginalVaultFile({
        headers: ctx.req.headers,
        reference: file[0].encryptedUrl,
      });

      await db.delete(vaultFiles).where(eq(vaultFiles.id, input.id));
      return { success: true };
    }),
});

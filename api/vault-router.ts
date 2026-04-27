import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { vaultFiles } from "@db/schema";
import { eq, and } from "drizzle-orm";

export const vaultRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        category: z.enum(["bloodwork", "genetics", "wearables", "body-composition", "notes", "other"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      if (input?.category) {
        return db
          .select()
          .from(vaultFiles)
          .where(and(eq(vaultFiles.userId, ctx.user.id), eq(vaultFiles.category, input.category)));
      }
      return db
        .select()
        .from(vaultFiles)
        .where(eq(vaultFiles.userId, ctx.user.id));
    }),

  upload: authedQuery
    .input(
      z.object({
        filename: z.string(),
        category: z.enum(["bloodwork", "genetics", "wearables", "body-composition", "notes", "other"]),
        size: z.number(),
        encryptedUrl: z.string().optional(),
        iv: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.insert(vaultFiles).values({
        userId: ctx.user.id,
        filename: input.filename,
        category: input.category,
        size: input.size,
        encryptedUrl: input.encryptedUrl,
        iv: input.iv,
      });
      return { id: Number(result[0].insertId) };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const file = await db
        .select()
        .from(vaultFiles)
        .where(eq(vaultFiles.id, input.id))
        .limit(1);

      if (!file[0] || file[0].userId !== ctx.user.id) {
        throw new Error("File not found");
      }

      await db.delete(vaultFiles).where(eq(vaultFiles.id, input.id));
      return { success: true };
    }),
});

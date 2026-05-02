import { eq } from "drizzle-orm";
import { vaultChunks, vaultFiles } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";
import { KimiApiClient } from "../kimi/api-client.js";
import { buildVaultChunks, computeVaultContentHash } from "./kimi-vault.js";
import { storeOriginalVaultFile } from "./vault-original-file.js";

const kimiApiClient = new KimiApiClient();

export async function ingestKimiVaultFile(params: {
  headers: Headers;
  userId: number;
  filename: string;
  fileType: string;
  category:
    | "bloodwork"
    | "genetics"
    | "wearables"
    | "body-composition"
    | "notes"
    | "other";
  contentType: string;
  bytes: Uint8Array;
}) {
  const db = getDb();
  const originalFileReference = await storeOriginalVaultFile({
    headers: params.headers,
    userId: params.userId,
    filename: params.filename,
    contentType: params.contentType,
    bytes: params.bytes,
  });
  const uploaded = await kimiApiClient.uploadFile({
    filename: params.filename,
    contentType: params.contentType,
    bytes: params.bytes,
  });
  const extractedText = await kimiApiClient.getFileContent(uploaded.id);
  const contentHash = computeVaultContentHash(extractedText);

  const inserted = await db
    .insert(vaultFiles)
    .values({
      userId: params.userId,
      filename: params.filename,
      fileType: params.fileType,
      category: params.category,
      size: params.bytes.byteLength,
      status: "ready",
      extractionStatus: "ready",
      encryptedUrl: originalFileReference,
      remoteFileId: uploaded.id,
      extractedText,
      contentHash,
      extractedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: vaultFiles.id });

  const vaultFileId = inserted[0]?.id;
  if (!vaultFileId) {
    throw new Error("Failed to persist the Kimi vault file.");
  }

  const chunks = buildVaultChunks({
    vaultFileId,
    content: extractedText,
  });

  if (chunks.length > 0) {
    await db.insert(vaultChunks).values(chunks);
  }

  const rows = await db
    .select()
    .from(vaultFiles)
    .where(eq(vaultFiles.id, vaultFileId))
    .limit(1);

  return rows[0];
}

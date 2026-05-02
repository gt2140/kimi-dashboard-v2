import { env } from "../lib/env.js";

const DEFAULT_STORAGE_BUCKET = "vault-files";
const INLINE_FALLBACK_MAX_BYTES = 5 * 1024 * 1024;

type StoreParams = {
  headers: Headers;
  userId: number;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
};

type ReadParams = {
  headers: Headers;
  reference: string;
};

export function buildInlineVaultFileReference(params: {
  contentType: string;
  bytes: Uint8Array;
}) {
  const base64 = Buffer.from(params.bytes).toString("base64");
  return `data:${params.contentType};base64,${base64}`;
}

export function decodeInlineVaultFileReference(reference: string) {
  const match = reference.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid inline vault file reference.");
  }

  return {
    contentType: match[1],
    bytes: new Uint8Array(Buffer.from(match[2], "base64")),
  };
}

export function parseVaultFileReference(reference: string) {
  if (reference.startsWith("data:")) {
    const match = reference.match(/^data:([^;]+);base64,/);
    return {
      kind: "inline" as const,
      contentType: match?.[1] || "application/octet-stream",
    };
  }

  const storageMatch = reference.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (storageMatch) {
    return {
      kind: "storage" as const,
      bucket: storageMatch[1],
      objectPath: storageMatch[2],
    };
  }

  return {
    kind: "unknown" as const,
  };
}

export async function storeOriginalVaultFile(params: StoreParams) {
  const accessToken = readBearerToken(params.headers);
  const objectPath = buildObjectPath(params.userId, params.filename);

  if (accessToken) {
    try {
      await uploadToSupabaseStorage({
        accessToken,
        bucket: readStorageBucket(),
        objectPath,
        contentType: params.contentType,
        bytes: params.bytes,
      });

      return `supabase://${readStorageBucket()}/${objectPath}`;
    } catch {
      // Fall through to the inline persistence fallback.
    }
  }

  if (params.bytes.byteLength > INLINE_FALLBACK_MAX_BYTES) {
    throw new Error(
      "Vault original file storage is not configured for large uploads yet. Configure Supabase Storage or use a smaller file.",
    );
  }

  return buildInlineVaultFileReference({
    contentType: params.contentType,
    bytes: params.bytes,
  });
}

export async function readOriginalVaultFile(params: ReadParams) {
  const parsed = parseVaultFileReference(params.reference);

  if (parsed.kind === "inline") {
    return decodeInlineVaultFileReference(params.reference);
  }

  if (parsed.kind === "storage") {
    const accessToken = readBearerToken(params.headers);
    if (!accessToken) {
      throw new Error("Supabase access token is required to preview this file.");
    }

    return downloadFromSupabaseStorage({
      accessToken,
      bucket: parsed.bucket,
      objectPath: parsed.objectPath,
    });
  }

  throw new Error("Unsupported vault file reference.");
}

export async function deleteOriginalVaultFile(params: {
  headers: Headers;
  reference: string | null | undefined;
}) {
  if (!params.reference) {
    return;
  }

  const parsed = parseVaultFileReference(params.reference);
  if (parsed.kind !== "storage") {
    return;
  }

  const accessToken = readBearerToken(params.headers);
  if (!accessToken) {
    return;
  }

  await deleteFromSupabaseStorage({
    accessToken,
    bucket: parsed.bucket,
    objectPath: parsed.objectPath,
  }).catch(() => undefined);
}

function readStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET;
}

function readBearerToken(headers: Headers) {
  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

function buildObjectPath(userId: number, filename: string) {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${userId}/${Date.now()}-${safeFilename}`;
}

function encodeObjectPath(path: string) {
  return path
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");
}

async function uploadToSupabaseStorage(params: {
  accessToken: string;
  bucket: string;
  objectPath: string;
  contentType: string;
  bytes: Uint8Array;
}) {
  ensureSupabaseStorageConfigured();

  const response = await fetch(
    `${env.supabaseUrl}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodeObjectPath(params.objectPath)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.accessToken}`,
        apikey: env.supabaseAnonKey,
        "content-type": params.contentType,
        "x-upsert": "true",
      },
      body: new Blob([Uint8Array.from(params.bytes)], { type: params.contentType }),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase storage upload failed with HTTP ${response.status}.`);
  }
}

async function downloadFromSupabaseStorage(params: {
  accessToken: string;
  bucket: string;
  objectPath: string;
}) {
  ensureSupabaseStorageConfigured();

  const response = await fetch(
    `${env.supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(params.bucket)}/${encodeObjectPath(params.objectPath)}`,
    {
      headers: {
        authorization: `Bearer ${params.accessToken}`,
        apikey: env.supabaseAnonKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase storage download failed with HTTP ${response.status}.`);
  }

  return {
    contentType:
      response.headers.get("content-type") || "application/octet-stream",
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}

async function deleteFromSupabaseStorage(params: {
  accessToken: string;
  bucket: string;
  objectPath: string;
}) {
  ensureSupabaseStorageConfigured();

  const response = await fetch(
    `${env.supabaseUrl}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodeObjectPath(params.objectPath)}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${params.accessToken}`,
        apikey: env.supabaseAnonKey,
      },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase storage delete failed with HTTP ${response.status}.`);
  }
}

function ensureSupabaseStorageConfigured() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Supabase Storage is not configured.");
  }
}

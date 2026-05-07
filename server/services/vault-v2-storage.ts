import { env } from "../lib/env.js";

const INLINE_FALLBACK_MAX_BYTES = 5 * 1024 * 1024;

export function buildInlineVaultDocumentReference(params: {
  contentType: string;
  bytes: Uint8Array;
}) {
  const base64 = Buffer.from(params.bytes).toString("base64");
  return `data:${params.contentType};base64,${base64}`;
}

export function parseVaultDocumentReference(reference: string) {
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

export function decodeInlineVaultDocumentReference(reference: string) {
  const match = reference.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid inline vault document reference.");
  }

  return {
    contentType: match[1],
    bytes: new Uint8Array(Buffer.from(match[2], "base64")),
  };
}

export async function storeVaultDocumentOriginal(params: {
  userId: number;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}) {
  if (env.supabaseUrl && env.supabaseServiceRoleKey) {
    const objectPath = buildObjectPath(params.userId, params.filename);
    await uploadToSupabaseStorage({
      bucket: env.supabaseStorageBucket,
      objectPath,
      contentType: params.contentType,
      bytes: params.bytes,
    });

    return `supabase://${env.supabaseStorageBucket}/${objectPath}`;
  }

  if (params.bytes.byteLength > INLINE_FALLBACK_MAX_BYTES) {
    throw new Error(
      "Vault V2 needs SUPABASE_SERVICE_ROLE_KEY for uploads larger than 5 MB.",
    );
  }

  return buildInlineVaultDocumentReference({
    contentType: params.contentType,
    bytes: params.bytes,
  });
}

export async function readVaultDocumentOriginal(reference: string) {
  const parsed = parseVaultDocumentReference(reference);

  if (parsed.kind === "inline") {
    return decodeInlineVaultDocumentReference(reference);
  }

  if (parsed.kind === "storage") {
    return downloadFromSupabaseStorage({
      bucket: parsed.bucket,
      objectPath: parsed.objectPath,
    });
  }

  throw new Error("Unsupported vault document reference.");
}

export async function deleteVaultDocumentOriginal(reference: string | null | undefined) {
  if (!reference) {
    return;
  }

  const parsed = parseVaultDocumentReference(reference);
  if (parsed.kind !== "storage") {
    return;
  }

  await deleteFromSupabaseStorage({
    bucket: parsed.bucket,
    objectPath: parsed.objectPath,
  }).catch(() => undefined);
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
  bucket: string;
  objectPath: string;
  contentType: string;
  bytes: Uint8Array;
}) {
  ensureServiceRoleStorageConfigured();

  const response = await fetch(
    `${env.supabaseUrl}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodeObjectPath(params.objectPath)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        apikey: env.supabaseServiceRoleKey,
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
  bucket: string;
  objectPath: string;
}) {
  ensureServiceRoleStorageConfigured();

  const response = await fetch(
    `${env.supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(params.bucket)}/${encodeObjectPath(params.objectPath)}`,
    {
      headers: {
        authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        apikey: env.supabaseServiceRoleKey,
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
  bucket: string;
  objectPath: string;
}) {
  ensureServiceRoleStorageConfigured();

  const response = await fetch(
    `${env.supabaseUrl}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodeObjectPath(params.objectPath)}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        apikey: env.supabaseServiceRoleKey,
      },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase storage delete failed with HTTP ${response.status}.`);
  }
}

function ensureServiceRoleStorageConfigured() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      "Vault V2 storage requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
}

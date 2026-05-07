import { buildAuthenticatedHeaders } from "@/lib/request-auth";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

export type VaultDocumentStatus =
  | "uploaded"
  | "extracting"
  | "profiling"
  | "ready"
  | "failed";

export type VaultDocument = {
  id: number;
  filename: string;
  mimeType: string;
  category: string;
  sizeBytes: number;
  status: VaultDocumentStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  categorySuggested?: string | null;
  categoryConfidence?: number | null;
  categoryMismatch?: boolean;
  readyAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  latestRun?: VaultDocumentRun | null;
};

export type VaultDocumentRun = {
  id: number;
  documentId: number;
  status: "queued" | "running" | "completed" | "failed";
  currentStage: string;
  attempt: number;
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
};

export type VaultDocumentEvent = {
  id: number;
  documentId: number;
  runId?: number | null;
  stage: string;
  status: string;
  message?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | Date;
};

async function readAccessToken() {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}

async function vaultFetch(input: string, init?: RequestInit) {
  const headers = await buildAuthenticatedHeaders(readAccessToken, init?.headers);
  const response = await fetch(input, {
    ...(init ?? {}),
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || `Vault V2 request failed with HTTP ${response.status}.`);
  }

  return response;
}

export async function listVaultDocuments() {
  const response = await vaultFetch("/api/vault/documents");
  const payload = (await response.json()) as { documents: VaultDocument[] };
  return payload.documents;
}

export async function getVaultDocument(documentId: number) {
  const response = await vaultFetch(`/api/vault/documents/${documentId}`);
  const payload = (await response.json()) as { document: VaultDocument };
  return payload.document;
}

export async function getVaultDocumentEvents(documentId: number) {
  const response = await vaultFetch(`/api/vault/documents/${documentId}/events`);
  const payload = (await response.json()) as { events: VaultDocumentEvent[] };
  return payload.events;
}

export async function uploadVaultDocument(params: {
  file: File;
  category: string;
}) {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("category", params.category);

  const response = await vaultFetch("/api/vault/documents", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json()) as {
    document: VaultDocument;
    run: VaultDocumentRun;
  };
  return payload;
}

export async function reclassifyVaultDocument(params: {
  documentId: number;
  category: string;
  reprocess?: boolean;
}) {
  const response = await vaultFetch(
    `/api/vault/documents/${params.documentId}/reclassify`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        category: params.category,
        reprocess: params.reprocess ?? true,
      }),
    },
  );
  return (await response.json()) as {
    document: VaultDocument;
    run: VaultDocumentRun | null;
  };
}

export async function deleteVaultDocument(documentId: number) {
  const response = await vaultFetch(`/api/vault/documents/${documentId}`, {
    method: "DELETE",
  });
  return (await response.json()) as { success: true };
}

export async function reprocessVaultDocument(documentId: number) {
  const response = await vaultFetch(`/api/vault/documents/${documentId}/reprocess`, {
    method: "POST",
  });
  return (await response.json()) as {
    document: VaultDocument;
    run: VaultDocumentRun;
  };
}

export async function fetchVaultDocumentOriginal(documentId: number) {
  const response = await vaultFetch(`/api/vault/documents/${documentId}/original`);
  return response.blob();
}

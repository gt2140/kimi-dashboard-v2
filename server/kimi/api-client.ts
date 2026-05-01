import { env } from "../lib/env.js";

type KimiUploadedFile = {
  id: string;
  object?: string;
  bytes?: number;
  filename?: string;
};

function getBaseUrl() {
  return env.kimiOpenUrl.replace(/\/$/, "");
}

function getVersionedBaseUrl() {
  const baseUrl = getBaseUrl();
  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

function getApiKey() {
  if (!env.kimiApiKey) {
    throw new Error(
      "KIMI_API_KEY is missing. Add it to app/.env before using Kimi V1.",
    );
  }

  return env.kimiApiKey;
}

async function kimiFetch(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Kimi request timed out while calling ${path}.`));
  }, 30_000);

  try {
    const response = await fetch(`${getVersionedBaseUrl()}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      const normalizedBody = body.toLowerCase();

      if (
        response.status === 401 &&
        (
          normalizedBody.includes("invalid authentication") ||
          normalizedBody.includes("incorrect api key provided")
        )
      ) {
        throw new Error(
          "KIMI_API_KEY is invalid for the Kimi API. Update the server environment with a valid key from platform.kimi.ai.",
        );
      }

      throw new Error(`Kimi request failed (${response.status}): ${body.slice(0, 500)}`);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class KimiApiClient {
  async uploadFile(params: {
    filename: string;
    contentType: string;
    bytes: Uint8Array;
    purpose?: "file-extract";
  }) {
    const form = new FormData();
    const fileBytes = Uint8Array.from(params.bytes);
    const blob = new Blob([fileBytes], { type: params.contentType });
    form.append("file", blob, params.filename);
    form.append("purpose", params.purpose ?? "file-extract");

    const response = await kimiFetch("/files", {
      method: "POST",
      body: form,
    });

    return (await response.json()) as KimiUploadedFile;
  }

  async getFileContent(fileId: string) {
    const response = await kimiFetch(`/files/${fileId}/content`);
    return await response.text();
  }

  async deleteFile(fileId: string) {
    await kimiFetch(`/files/${fileId}`, {
      method: "DELETE",
    });
  }
}
export type { KimiUploadedFile };

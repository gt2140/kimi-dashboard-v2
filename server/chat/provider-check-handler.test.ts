import { describe, expect, it, vi } from "vitest";
import { handleProviderCheckRequest } from "./provider-check-handler.js";

describe("handleProviderCheckRequest", () => {
  it("requires the same authenticated session as chat", async () => {
    const response = await handleProviderCheckRequest(
      new Request("https://example.com/api/chat/provider-check"),
      {
        authenticateRequest: vi.fn().mockRejectedValue(
          new Error("Invalid authentication token.")
        ),
        gateway: {
          diagnoseVenice: vi.fn(),
        },
      }
    );

    await expect(response.json()).resolves.toMatchObject({
      error: {
        category: "auth",
      },
    });
    expect(response.status).toBe(401);
  });

  it("returns the sanitized Venice diagnostic payload", async () => {
    const response = await handleProviderCheckRequest(
      new Request("https://example.com/api/chat/provider-check"),
      {
        authenticateRequest: vi.fn().mockResolvedValue({ id: 7 }),
        gateway: {
          diagnoseVenice: vi.fn().mockResolvedValue({
            ok: false,
            providerSlug: "venice",
            modelName: "zai-org-glm-5",
            status: 401,
            category: "auth",
            message:
              "Venice request failed (401). Check VENICE_API_KEY or VENICE_INFERENCE_KEY.",
          }),
        },
      }
    );

    await expect(response.json()).resolves.toEqual({
      provider: {
        ok: false,
        providerSlug: "venice",
        modelName: "zai-org-glm-5",
        status: 401,
        category: "auth",
        message:
          "Venice request failed (401). Check VENICE_API_KEY or VENICE_INFERENCE_KEY.",
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

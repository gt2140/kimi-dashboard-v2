import { describe, expect, it } from "vitest";
import { app } from "./http-app.js";

describe("Vault V2 HTTP routes", () => {
  it("protects kimi chat stream with auth", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/kimi/chat/stream", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("protects vault v2 upload with auth", async () => {
    const formData = new FormData();
    formData.append("category", "bloodwork");
    formData.append(
      "file",
      new File(["hemoglobin"], "bloodwork.txt", { type: "text/plain" }),
    );

    const response = await app.fetch(
      new Request("http://localhost/api/vault/documents", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(401);
  });

  it("protects vault v2 list with auth", async () => {
    const response = await app.fetch(
      new Request("http://localhost/api/vault/documents"),
    );

    expect(response.status).toBe(401);
  });
});

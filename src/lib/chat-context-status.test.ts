import { describe, expect, it } from "vitest";
import { buildChatContextStatus } from "./chat-context-status";

describe("buildChatContextStatus", () => {
  it("summarizes ready vault files and active helpers", () => {
    expect(
      buildChatContextStatus({
        vaultLoading: false,
        vaultReadyCount: 3,
        vaultTotalCount: 5,
        helperCount: 2,
      }),
    ).toEqual({
      vaultLabel: "Vault ready",
      vaultDetail: "3 ready / 5 files",
      helperLabel: "2 helpers",
    });
  });

  it("shows vault off when no files are ready", () => {
    expect(
      buildChatContextStatus({
        vaultLoading: false,
        vaultReadyCount: 0,
        vaultTotalCount: 4,
        helperCount: 0,
      }),
    ).toMatchObject({
      vaultLabel: "Vault off",
      vaultDetail: "No ready files",
      helperLabel: "No helpers",
    });
  });
});

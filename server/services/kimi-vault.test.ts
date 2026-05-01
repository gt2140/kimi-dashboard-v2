import { describe, expect, it } from "vitest";
import {
  buildVaultChunks,
  computeVaultContentHash,
  selectVaultChunksForPrompt,
} from "./kimi-vault.js";

describe("computeVaultContentHash", () => {
  it("returns a deterministic hash for extracted content", () => {
    const first = computeVaultContentHash("Hemoglobin A1c 5.2%");
    const second = computeVaultContentHash("Hemoglobin A1c 5.2%");

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(10);
  });
});

describe("buildVaultChunks", () => {
  it("splits extracted text into deterministic sequential chunks", () => {
    const chunks = buildVaultChunks({
      vaultFileId: 7,
      content:
        "Total cholesterol 180. LDL 100. HDL 60. Triglycerides 90. ApoB 82.",
      chunkSize: 24,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatchObject({
      vaultFileId: 7,
      chunkIndex: 0,
    });
    expect(chunks[1]?.chunkIndex).toBe(1);
  });
});

describe("selectVaultChunksForPrompt", () => {
  it("prefers chunks whose text overlaps with the user question", () => {
    const selected = selectVaultChunksForPrompt({
      query: "What does my ApoB suggest?",
      chunks: [
        {
          vaultFileId: 1,
          chunkIndex: 0,
          content: "This section talks about sleep duration and HRV.",
        },
        {
          vaultFileId: 1,
          chunkIndex: 1,
          content: "ApoB is 82 mg/dL and LDL is 100 mg/dL.",
        },
      ],
      maxChunks: 1,
    });

    expect(selected).toHaveLength(1);
    expect(selected[0]?.chunkIndex).toBe(1);
  });
});

import { createHash } from "node:crypto";

type VaultChunk = {
  vaultFileId: number;
  chunkIndex: number;
  content: string;
};

export function computeVaultContentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function buildVaultChunks(input: {
  vaultFileId: number;
  content: string;
  chunkSize?: number;
}) {
  const normalized = input.content.replace(/\s+/g, " ").trim();
  const chunkSize = Math.max(64, input.chunkSize ?? 1200);
  const chunks: VaultChunk[] = [];

  for (let start = 0, index = 0; start < normalized.length; start += chunkSize, index += 1) {
    chunks.push({
      vaultFileId: input.vaultFileId,
      chunkIndex: index,
      content: normalized.slice(start, start + chunkSize),
    });
  }

  return chunks;
}

export function selectVaultChunksForPrompt(input: {
  query: string;
  chunks: VaultChunk[];
  maxChunks?: number;
}) {
  const queryTerms = tokenize(input.query);
  const maxChunks = Math.max(1, input.maxChunks ?? 4);

  return [...input.chunks]
    .map(chunk => ({
      chunk,
      score: scoreChunk(chunk.content, queryTerms),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, maxChunks)
    .map(entry => entry.chunk);
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map(term => term.trim())
    .filter(term => term.length > 1);
}

function scoreChunk(content: string, queryTerms: string[]) {
  const normalized = content.toLowerCase();
  return queryTerms.reduce((score, term) => {
    return score + (normalized.includes(term.toLowerCase()) ? 1 : 0);
  }, 0);
}

export type { VaultChunk };

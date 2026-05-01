import { and, desc, eq, inArray } from "drizzle-orm";
import { conversationMemories, userMemories } from "../../db/schema.js";
import { env } from "../lib/env.js";
import {
  buildKimiChatRequest,
  extractKimiAssistantText,
} from "../kimi/chat-client.js";
import { getDb } from "../queries/connection.js";

type KimiClientLike = {
  createChatCompletion: (request: ReturnType<typeof buildKimiChatRequest>) => Promise<{
    choices?: Array<{
      message?: {
        content?: string | null;
      };
    }>;
  }>;
};

type MemoryUpdate = {
  conversationSummary: string;
  userMemories: Array<{
    key: string;
    value: string;
    confidence?: number;
  }>;
};

const MEMORY_SCHEMA = {
  name: "aura_memory_update",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      conversationSummary: {
        type: "string",
      },
      userMemories: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string" },
            value: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["key", "value"],
        },
      },
    },
    required: ["conversationSummary", "userMemories"],
  },
} as const;

export function buildMemoryExtractionPrompt(input: {
  existingSummary?: string | null;
  recentMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}) {
  const history = input.recentMessages
    .map(message => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  return [
    "Update Aura's persistent memory for this conversation and this user.",
    "Write a compact conversation summary that will help the next turn continue naturally.",
    "Extract only stable user memories that are likely to matter again: preferences, goals, ongoing projects, recurring constraints, relevant profile facts, or durable operating instructions.",
    "Do not store one-off asks, temporary moods, or facts that were explicitly uncertain.",
    "Use short snake_case keys for user memories.",
    input.existingSummary?.trim()
      ? `Existing conversation summary:\n${input.existingSummary.trim()}`
      : "Existing conversation summary:\n(none yet)",
    `Recent conversation:\n${history}`,
  ].join("\n\n");
}

export function parseMemoryUpdate(content: string): MemoryUpdate | null {
  try {
    const parsed = JSON.parse(content) as {
      conversationSummary?: unknown;
      userMemories?: unknown;
    };

    const conversationSummary =
      typeof parsed.conversationSummary === "string"
        ? parsed.conversationSummary.trim()
        : "";
    const userMemories = Array.isArray(parsed.userMemories)
      ? parsed.userMemories
          .map(item => normalizeMemoryItem(item))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : [];

    return {
      conversationSummary,
      userMemories,
    };
  } catch {
    return null;
  }
}

export async function persistKimiTurnMemory(params: {
  userId: number;
  conversationId: number;
  sourceRunId: number;
  existingSummary?: string | null;
  recentMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  kimiClient: KimiClientLike;
}) {
  const request = buildKimiChatRequest({
    model: env.kimiModel,
    systemPrompt:
      "You maintain project-style memory for Aura. Be conservative, factual, compact, and only store information that will help future turns.",
    messages: [
      {
        role: "user",
        content: buildMemoryExtractionPrompt({
          existingSummary: params.existingSummary,
          recentMessages: params.recentMessages.slice(-10),
        }),
      },
    ],
    thinking: "disabled",
    temperature: 0,
    jsonSchema: MEMORY_SCHEMA,
  });

  const completion = await params.kimiClient.createChatCompletion(request);
  const parsed = parseMemoryUpdate(extractKimiAssistantText(completion));
  if (!parsed) {
    return null;
  }

  await Promise.all([
    persistConversationSummary({
      conversationId: params.conversationId,
      sourceRunId: params.sourceRunId,
      summary: parsed.conversationSummary,
    }),
    persistUserMemoryBatch({
      userId: params.userId,
      sourceRunId: params.sourceRunId,
      memories: parsed.userMemories,
    }),
  ]);

  return parsed;
}

async function persistConversationSummary(input: {
  conversationId: number;
  sourceRunId: number;
  summary: string;
}) {
  const summary = input.summary.trim();
  if (!summary) {
    return;
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(conversationMemories)
    .where(eq(conversationMemories.conversationId, input.conversationId))
    .orderBy(desc(conversationMemories.updatedAt))
    .limit(1);

  if (existing[0]) {
    await db
      .update(conversationMemories)
      .set({
        summary,
        sourceRunId: input.sourceRunId,
        updatedAt: new Date(),
      })
      .where(eq(conversationMemories.id, existing[0].id));
    return;
  }

  await db.insert(conversationMemories).values({
    conversationId: input.conversationId,
    sourceRunId: input.sourceRunId,
    summary,
  });
}

async function persistUserMemoryBatch(input: {
  userId: number;
  sourceRunId: number;
  memories: Array<{
    key: string;
    value: string;
    confidence?: number;
  }>;
}) {
  if (input.memories.length === 0) {
    return;
  }

  const db = getDb();

  for (const memory of input.memories.slice(0, 8)) {
    const existing = await db
      .select()
      .from(userMemories)
      .where(
        and(
          eq(userMemories.userId, input.userId),
          eq(userMemories.memoryKey, memory.key),
        ),
      )
      .orderBy(desc(userMemories.updatedAt))
      .limit(1);

    const nextConfidence =
      typeof memory.confidence === "number"
        ? String(Math.max(0, Math.min(1, memory.confidence)).toFixed(2))
        : null;

    if (existing[0]) {
      await db
        .update(userMemories)
        .set({
          value: memory.value,
          confidence: nextConfidence,
          sourceRunId: input.sourceRunId,
          updatedAt: new Date(),
        })
        .where(eq(userMemories.id, existing[0].id));
      continue;
    }

    await db.insert(userMemories).values({
      userId: input.userId,
      memoryKey: memory.key,
      value: memory.value,
      confidence: nextConfidence,
      sourceRunId: input.sourceRunId,
    });
  }

  const overflow = await db
    .select({ id: userMemories.id })
    .from(userMemories)
    .where(eq(userMemories.userId, input.userId))
    .orderBy(desc(userMemories.updatedAt))
    .offset(24);

  if (overflow.length > 0) {
    await db
      .delete(userMemories)
      .where(
        inArray(
          userMemories.id,
          overflow.map(item => item.id),
        ),
      );
  }
}

function normalizeMemoryItem(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    key?: unknown;
    value?: unknown;
    confidence?: unknown;
  };
  const key = normalizeMemoryKey(candidate.key);
  const memoryValue =
    typeof candidate.value === "string" ? candidate.value.trim() : "";

  if (!key || !memoryValue) {
    return null;
  }

  return {
    key,
    value: memoryValue.slice(0, 500),
    confidence:
      typeof candidate.confidence === "number" ? candidate.confidence : undefined,
  };
}

function normalizeMemoryKey(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationTurnService } from "./conversation-turn-service.js";

function buildAssistantReply() {
  return {
    content: "assistant reply",
    relatedVaultFiles: [],
    orchestrationMode: "single_agent" as const,
    consultedAgentSlugs: [],
    supportingAgentNames: [],
    consultationMode: "none" as const,
    consultationReason: null,
    contextSummary: "context",
    missingContext: [],
    executionNotes: [],
    supportingRuns: [],
    operationalFailureReason: null,
    note: null,
    primaryRun: {
      providerSlug: "openai",
      modelName: "gpt-test",
      requestedProviderSlug: null,
      requestedModelName: null,
      executionNotes: [],
      systemPrompt: "system",
      inputMessages: [{ role: "user" as const, content: "hello" }],
      inputTokens: 1,
      outputTokens: 2,
      errorMessage: null,
      usedFallback: false,
    },
    responseMode: "model" as const,
  };
}

describe("ConversationTurnService", () => {
  let callOrder: string[];

  beforeEach(() => {
    callOrder = [];
  });

  it("persists the user message and creates the primary run before reply generation starts", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 10,
        title: "New conversation",
      }),
      createUserMessage: vi.fn().mockImplementation(async () => {
        callOrder.push("user-message");
        return { id: 101 };
      }),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 202,
        createdAt: new Date("2026-04-30T23:00:00.000Z"),
      }),
      updateConversationAfterTurn: vi.fn().mockResolvedValue(undefined),
    };
    const agentRunRepository = {
      createPrimaryRun: vi.fn().mockImplementation(async () => {
        callOrder.push("primary-run");
        return { id: 303 };
      }),
      markPrimaryRunRunning: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRun: vi.fn().mockResolvedValue(undefined),
      createSupportingRuns: vi.fn().mockResolvedValue(undefined),
      createMessageContextBlocks: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRunFailure: vi.fn().mockResolvedValue(undefined),
    };
    const syncParticipants = vi.fn().mockResolvedValue({
      primary: { id: 1 },
      supporting: [],
    });
    syncParticipants.mockImplementation(async () => {
      callOrder.push("sync-participants");
      return {
        primary: { id: 1 },
        supporting: [],
      };
    });
    const resolveModelReference = vi.fn().mockResolvedValue({
      providerId: 1,
      modelEndpointId: 2,
    });
    const replyBuilder = {
      buildReply: vi.fn().mockImplementation(async () => {
        callOrder.push("reply-builder");
        return buildAssistantReply();
      }),
    };

    const service = new ConversationTurnService({
      conversationRepository,
      agentRunRepository,
      syncParticipants,
      resolveModelReference,
      replyBuilder,
    });

    await service.executeTurn({
      input: {
        conversationId: 10,
        content: "hello",
        agentId: "generalist",
        calledAgentIds: [],
      },
      userId: 1,
    });

    expect(callOrder.slice(0, 4)).toEqual([
      "user-message",
      "sync-participants",
      "primary-run",
      "reply-builder",
    ]);
  });

  it("finalizes the primary run as failed when reply generation throws after the run starts", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 10,
        title: "New conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 101 }),
      createAssistantMessage: vi.fn(),
      updateConversationAfterTurn: vi.fn(),
    };
    const agentRunRepository = {
      createPrimaryRun: vi.fn().mockResolvedValue({ id: 303 }),
      markPrimaryRunRunning: vi.fn().mockResolvedValue(undefined),
      finalizePrimaryRun: vi.fn(),
      createSupportingRuns: vi.fn(),
      createMessageContextBlocks: vi.fn(),
      finalizePrimaryRunFailure: vi.fn().mockResolvedValue(undefined),
    };
    const replyBuilder = {
      buildReply: vi.fn().mockRejectedValue(new Error("reply-builder failed")),
    };

    const service = new ConversationTurnService({
      conversationRepository,
      agentRunRepository,
      syncParticipants: vi.fn().mockResolvedValue({
        primary: { id: 1 },
        supporting: [],
      }),
      resolveModelReference: vi.fn(),
      replyBuilder,
    });

    await expect(
      service.executeTurn({
        input: {
          conversationId: 10,
          content: "hello",
          agentId: "generalist",
          calledAgentIds: [],
        },
        userId: 1,
      })
    ).rejects.toThrow("reply-builder failed");

    expect(agentRunRepository.finalizePrimaryRunFailure).toHaveBeenCalledWith(
      303,
      expect.objectContaining({
        errorMessage: "reply-builder failed",
      })
    );
  });
});

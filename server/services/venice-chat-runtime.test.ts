import { describe, expect, it, vi } from "vitest";
import { VeniceFirstConversationTurnRuntime } from "./venice-chat-runtime.js";

describe("VeniceFirstConversationTurnRuntime", () => {
  it("injects agent presets and vault context into the active Venice prompt", async () => {
    const conversationRepository = {
      requireConversationOwner: vi.fn().mockResolvedValue({
        id: 42,
        summary: "The user has been tracking ApoB and sleep quality.",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 101 }),
      createAssistantMessage: vi.fn().mockImplementation(async input => ({
        id: 202,
        createdAt: new Date("2026-05-15T16:30:00.000Z"),
        ...input,
      })),
      updateConversationAfterTurn: vi.fn().mockResolvedValue(undefined),
    };
    const modelGateway = {
      getDefaultModel: vi.fn().mockReturnValue("zai-org-glm-5"),
      streamText: vi.fn(),
      generateText: vi.fn().mockResolvedValue({
        text: "Your ApoB context is available.",
        providerSlug: "venice",
        modelName: "zai-org-glm-5",
        inputTokens: 100,
        outputTokens: 20,
      }),
    };
    const contextLoader = vi.fn().mockResolvedValue({
      conversationSummary: "Conversation summary from context loader.",
      recentMessages: [
        {
          role: "user",
          content: "Previous question about lipids.",
        },
      ],
      accessibleFiles: [
        {
          id: 7,
          filename: "apob-panel.pdf",
          category: "bloodwork",
          status: "ready",
        },
      ],
      vaultContext: {
        clinicalProfileSummary:
          "Clinical profile: LDL-C 132 mg/dL, ApoB 104 mg/dL, hsCRP normal.",
        selectedVaultChunks: [
          {
            documentId: 7,
            chunkIndex: 2,
            content:
              "ApoB result 104 mg/dL. LDL-C 132 mg/dL. Triglycerides 91 mg/dL.",
          },
        ],
      },
      resolvedAgentProfile: {
        customContext: "User prefers direct health tradeoffs.",
        trainingNotes: "Always call out uncertainty.",
        allowVaultContext: true,
      },
      latestUserMessage: "Use my vault to summarize ApoB.",
    });

    const runtime = new VeniceFirstConversationTurnRuntime({
      conversationRepository,
      modelGateway,
      contextLoader,
      loadRecentMessages: vi.fn().mockResolvedValue([]),
    });

    const result = await runtime.executeTurn({
      userId: 5,
      conversationId: 42,
      content: "Use my vault to summarize ApoB.",
      agentId: "generalist",
      stream: false,
    });

    expect(contextLoader).toHaveBeenCalledWith({
      userId: 5,
      conversationId: 42,
      agentSlug: "generalist",
      latestUserMessage: "Use my vault to summarize ApoB.",
    });
    expect(modelGateway.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("apob-panel.pdf (bloodwork)"),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: "Previous question about lipids.",
          }),
        ]),
      }),
    );
    expect(modelGateway.generateText.mock.calls[0]?.[0].systemPrompt).toContain(
      "User prefers direct health tradeoffs.",
    );
    expect(modelGateway.generateText.mock.calls[0]?.[0].systemPrompt).toContain(
      "Always call out uncertainty.",
    );
    expect(modelGateway.generateText.mock.calls[0]?.[0].systemPrompt).toContain(
      "Clinical profile: LDL-C 132 mg/dL, ApoB 104 mg/dL",
    );
    expect(modelGateway.generateText.mock.calls[0]?.[0].systemPrompt).toContain(
      "[document 7, chunk 2] ApoB result 104 mg/dL.",
    );
    expect(result.assistantMessage.metadata).toEqual(
      expect.objectContaining({
        relatedVaultFiles: ["apob-panel.pdf"],
        contextSummary: expect.stringContaining("1 vault file"),
      }),
    );
  });
});

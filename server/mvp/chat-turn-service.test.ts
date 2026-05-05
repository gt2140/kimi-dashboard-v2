import { describe, expect, it, vi } from "vitest";
import { MvpChatTurnService } from "./chat-turn-service.js";

describe("MvpChatTurnService", () => {
  it("creates the conversation inside the send flow when no conversation id is provided", async () => {
    const store = {
      createConversation: vi.fn().mockResolvedValue({ id: 88 }),
      requireConversation: vi.fn().mockResolvedValue({
        id: 88,
        title: "New conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 101 }),
      listRecentMessages: vi.fn().mockResolvedValue([
        {
          role: "user",
          content: "Hola desde cero",
        },
      ]),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 202,
        createdAt: new Date("2026-05-01T18:00:00.000Z"),
      }),
      finalizeConversation: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      respond: vi.fn().mockResolvedValue({
        content: "Respuesta simple de Kimi.",
        model: "kimi-k2.6",
        finishReason: "stop",
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
        },
      }),
    };
    const medicalResearchService = {
      search: vi.fn().mockResolvedValue([]),
    };

    const service = new MvpChatTurnService(
      store as never,
      kimiClient as never,
      medicalResearchService as never,
    );

    const result = await service.execute({
      content: "Hola desde cero",
      agentId: "generalist",
      userId: 3,
    });

    expect(store.createConversation).toHaveBeenCalledWith({
      userId: 3,
      agentId: "generalist",
      title: "Hola desde cero",
    });
    expect(store.createUserMessage).toHaveBeenCalledWith({
      conversationId: 88,
      agentId: "generalist",
      content: "Hola desde cero",
    });
    expect(result.content).toBe("Respuesta simple de Kimi.");
  });

  it("saves the user message, requests Kimi once, and persists the assistant reply", async () => {
    const store = {
      requireConversation: vi.fn().mockResolvedValue({
        id: 14,
        title: "New conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 101 }),
      listRecentMessages: vi.fn().mockResolvedValue([
        {
          role: "user",
          content: "Primer mensaje",
        },
        {
          role: "assistant",
          content: "Primera respuesta",
        },
        {
          role: "user",
          content: "Hola",
        },
      ]),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 202,
        createdAt: new Date("2026-05-01T18:00:00.000Z"),
      }),
      finalizeConversation: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      respond: vi.fn().mockResolvedValue({
        content: "Respuesta simple de Kimi.",
        model: "kimi-k2.6",
        finishReason: "stop",
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
        },
      }),
    };
    const medicalResearchService = {
      search: vi.fn().mockResolvedValue([]),
    };

    const service = new MvpChatTurnService(
      store as never,
      kimiClient as never,
      medicalResearchService as never,
    );

    const result = await service.execute({
      conversationId: 14,
      content: "Hola",
      agentId: "generalist",
      userId: 3,
    });

    expect(store.createUserMessage).toHaveBeenCalledWith({
      conversationId: 14,
      agentId: "generalist",
      content: "Hola",
    });
    expect(kimiClient.respond).toHaveBeenCalledWith(
      {
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.any(String),
          }),
          {
            role: "user",
            content: "Primer mensaje",
          },
          {
            role: "assistant",
            content: "Primera respuesta",
          },
          {
            role: "user",
            content: "Hola",
          },
        ],
        userId: 3,
      },
    );
    expect(result.content).toBe("Respuesta simple de Kimi.");
    expect(store.createAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 14,
        agentId: "generalist",
        content: "Respuesta simple de Kimi.",
      }),
    );
  });

  it("runs medical evidence retrieval for the research synthesizer agent", async () => {
    const store = {
      requireConversation: vi.fn().mockResolvedValue({
        id: 14,
        title: "Research conversation",
      }),
      createUserMessage: vi.fn().mockResolvedValue({ id: 101 }),
      listRecentMessages: vi.fn().mockResolvedValue([
        {
          role: "user",
          content: "Does omega-3 help with inflammation?",
        },
      ]),
      createAssistantMessage: vi.fn().mockResolvedValue({
        id: 303,
        createdAt: new Date("2026-05-01T18:00:00.000Z"),
      }),
      finalizeConversation: vi.fn().mockResolvedValue(undefined),
    };

    const kimiClient = {
      respond: vi.fn().mockResolvedValue({
        content: "Summary\nEvidence\nLimitations\nSafety note\nSources",
        model: "kimi-k2.6",
        finishReason: "stop",
        usage: {
          inputTokens: 30,
          outputTokens: 20,
          totalTokens: 50,
        },
      }),
    };
    const medicalResearchService = {
      search: vi.fn().mockResolvedValue([
        {
          source: "pubmed",
          title: "Omega-3 and inflammation",
          url: "https://doi.org/10.1000/example",
          summary: "Nutrition Journal, 2025. Smith J et al.",
          citation: "Smith J et al. Omega-3 and inflammation.",
        },
      ]),
    };

    const service = new MvpChatTurnService(
      store as never,
      kimiClient as never,
      medicalResearchService as never,
    );

    const result = await service.execute({
      conversationId: 14,
      content: "Does omega-3 help with inflammation?",
      agentId: "research-synthesizer",
      userId: 3,
    });

    expect(medicalResearchService.search).toHaveBeenCalledWith(
      "Does omega-3 help with inflammation?",
    );
    expect(kimiClient.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("Evidence set:"),
          }),
          {
            role: "user",
            content: "Does omega-3 help with inflammation?",
          },
        ],
      }),
    );
    expect(result.metadata).toMatchObject({
      researchEvidence: [
        {
          source: "pubmed",
          title: "Omega-3 and inflammation",
          url: "https://doi.org/10.1000/example",
        },
      ],
    });
  });
});

import { describe, expect, it } from "vitest";
import { buildContextAwareFallbackReply } from "./fallback-reply";

describe("buildContextAwareFallbackReply", () => {
  it("answers capability questions with a concrete overview", () => {
    const result = buildContextAwareFallbackReply({
      userMessage: "con que me podes ayudar?",
      agentName: "Generalist",
      allowedCategories: ["bloodwork", "body-composition", "genetics", "notes"],
      accessibleFileCount: 0,
    });

    expect(result.content.toLowerCase()).toContain("puedo ayudarte");
    expect(result.content.toLowerCase()).toContain("analizar");
    expect(result.note).toBe("Respuesta util sin contexto del vault todavia.");
  });

  it("gives a useful dexa-oriented answer without uploaded files", () => {
    const result = buildContextAwareFallbackReply({
      userMessage: "Explain my DEXA scan",
      agentName: "Generalist",
      allowedCategories: ["body-composition"],
      accessibleFileCount: 0,
    });

    expect(result.content.toLowerCase()).toContain("dexa");
    expect(result.content.toLowerCase()).toContain("masa magra");
    expect(result.content.toLowerCase()).toContain("grasa corporal");
  });

  it("gives practical muscle-gain diet guidance without uploaded files", () => {
    const result = buildContextAwareFallbackReply({
      userMessage:
        "quiero que analicen cual seria la mejor dieta para mi composicion corporal para poder aumentar de peso y musculo 5 kg",
      agentName: "Generalist",
      allowedCategories: ["body-composition", "notes"],
      accessibleFileCount: 0,
    });

    expect(result.content.toLowerCase()).toContain("superavit");
    expect(result.content.toLowerCase()).toContain("proteina");
    expect(result.content.toLowerCase()).toContain("5 kg");
  });

  it("gives a useful supplements and peptides overview for muscle and energy goals", () => {
    const result = buildContextAwareFallbackReply({
      userMessage:
        "cuales son los mejores combinaciones de suplementos y peptidos para ganar musculo y tener mas energia?",
      agentName: "Generalist",
      allowedCategories: ["bloodwork", "body-composition", "notes"],
      accessibleFileCount: 0,
    });

    expect(result.content.toLowerCase()).toContain("creatina");
    expect(result.content.toLowerCase()).toContain("proteina");
    expect(result.content.toLowerCase()).toContain("bpc-157");
    expect(result.content.toLowerCase()).toContain("energia");
  });
});

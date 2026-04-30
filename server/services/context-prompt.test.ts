import { describe, expect, it } from "vitest";
import {
  buildContextSummary,
  collectMissingContext,
  formatPromptContext,
} from "./context-prompt.js";

describe("context-prompt", () => {
  it("summarizes available context in a compact diagnostic string", () => {
    const summary = buildContextSummary({
      recentMessages: [{ role: "user", content: "hola" }],
      accessibleFiles: [{ filename: "labs.pdf", category: "medical_records" }],
      conversationSummary: "Seguimiento de sintomas digestivos.",
      customContext: "Prefiere respuestas breves.",
      trainingNotes: null,
      allowVaultContext: true,
    });

    expect(summary).toContain("1 recent message");
    expect(summary).toContain("1 vault file");
    expect(summary).toContain("conversation summary available");
    expect(summary).toContain("custom agent context enabled");
  });

  it("surfaces missing context and trims oversized prompt blocks", () => {
    const prompt = formatPromptContext({
      userMessage: "Que hago con estos sintomas?",
      conversationSummary: null,
      recentMessages: Array.from({ length: 8 }, (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content:
          index === 7
            ? `message-${index + 1}-${"x".repeat(520)}`
            : `message-${index + 1}`,
      })),
      accessibleFiles: Array.from({ length: 7 }, (_, index) => ({
        filename: `file-${index + 1}.pdf`,
        category: "medical_records",
      })),
      customContext: null,
      trainingNotes: null,
      allowVaultContext: true,
      supportingNotes: Array.from({ length: 4 }, (_, index) => ({
        agentName: `Agent ${index + 1}`,
        content:
          index === 0 ? `note-${index + 1}-${"y".repeat(720)}` : `note-${index + 1}`,
        status: "completed" as const,
      })),
      taskInstruction: "Respond clearly.",
    });

    expect(prompt).toContain("<context_snapshot>");
    expect(prompt).toContain("<missing_context>");
    expect(prompt).toContain("earlier message(s) omitted for brevity");
    expect(prompt).toContain("additional compatible file(s) omitted for brevity");
    expect(prompt).toContain("additional specialist note(s) omitted for brevity");
    expect(prompt).toContain("This conversation does not have a long-form summary yet.");
    expect(prompt).toContain("No user-specific agent guidance is configured yet.");
    expect(prompt).toContain("message-8-");
    expect(prompt).not.toContain("x".repeat(520));
    expect(prompt).not.toContain("y".repeat(720));
  });

  it("collects only the missing signals that actually matter", () => {
    const missing = collectMissingContext({
      recentMessages: [{ role: "user", content: "hola" }],
      accessibleFiles: [],
      conversationSummary: null,
      customContext: null,
      trainingNotes: null,
      allowVaultContext: false,
    });

    expect(missing).toHaveLength(2);
    expect(missing).toContain(
      "This conversation does not have a long-form summary yet."
    );
    expect(missing).toContain(
      "No user-specific agent guidance is configured yet."
    );
  });

  it("marks vault context as disabled when the agent should not use it", () => {
    const summary = buildContextSummary({
      recentMessages: [],
      accessibleFiles: [],
      conversationSummary: null,
      customContext: null,
      trainingNotes: null,
      allowVaultContext: false,
    });

    expect(summary).toContain("vault context disabled");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildOperationalFallbackNote,
  extractOperationalFailureReason,
} from "./chat-fallback.js";

describe("extractOperationalFailureReason", () => {
  it("surfaces quota exhaustion clearly", () => {
    const reason = extractOperationalFailureReason(
      new Error(
        "You exceeded your current quota, please check your plan and billing details."
      )
    );

    expect(reason).toBe(
      "OpenAI no pudo responder porque la cuota del proveedor esta agotada."
    );
  });

  it("falls back to the original error message for unexpected provider issues", () => {
    const reason = extractOperationalFailureReason(
      new Error("OpenAI streaming response did not include a readable body.")
    );

    expect(reason).toBe(
      "OpenAI streaming response did not include a readable body."
    );
  });
});

describe("buildOperationalFallbackNote", () => {
  it("prioritizes the operational failure over generic missing-file guidance", () => {
    const note = buildOperationalFallbackNote({
      operationalFailureReason:
        "OpenAI no pudo responder porque la cuota del proveedor esta agotada.",
      fallbackReplyNote: "Sin archivos de bloodwork disponibles todavia.",
    });

    expect(note).toContain("OpenAI no pudo responder");
    expect(note).not.toContain("Sin archivos de bloodwork");
  });

  it("keeps the contextual fallback note when there is no provider failure", () => {
    const note = buildOperationalFallbackNote({
      operationalFailureReason: null,
      fallbackReplyNote: "Sin archivos de bloodwork disponibles todavia.",
    });

    expect(note).toBe("Sin archivos de bloodwork disponibles todavia.");
  });
});

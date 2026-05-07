import { describe, expect, it } from "vitest";
import {
  inferVaultCategoryFromUpload,
  inferVaultCategorySuggestionFromContent,
} from "./vault-classification";

describe("vault classification", () => {
  it("does not classify every PDF as bloodwork", () => {
    expect(
      inferVaultCategoryFromUpload({
        fileName: "SIBO estudio aliento.pdf",
        mimeType: "application/pdf",
      }).category,
    ).toBe("other");

    expect(
      inferVaultCategoryFromUpload({
        fileName: "resultados laboratorio sangre.pdf",
        mimeType: "application/pdf",
      }).category,
    ).toBe("bloodwork");
  });

  it("flags content mismatches for non-bloodwork medical documents", () => {
    const suggestion = inferVaultCategorySuggestionFromContent({
      fileName: "TAYLOR GASTON SIBO.pdf",
      mimeType: "application/pdf",
      content:
        "SIBO (Muestra de aliento) Lactulosa CH4 H2 Interpretación positiva para sobrecrecimiento.",
      currentCategory: "bloodwork",
    });

    expect(suggestion.category).toBe("other");
    expect(suggestion.categoryMismatch).toBe(true);
    expect(suggestion.confidence).toBeGreaterThan(0.5);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildClinicalProfile,
  buildVaultContextSnippet,
  buildVaultDocumentChunks,
  extractBloodworkMeasurements,
  normalizeExtractedDocumentText,
  resolveVaultQueryMode,
  selectVaultDocumentChunksForPrompt,
} from "./vault-v2.js";
import { shouldUseKimiPrimaryExtraction } from "./vault-v2-service.js";

describe("buildClinicalProfile", () => {
  it("builds a stable clinical summary from ready medical documents", () => {
    const profile = buildClinicalProfile({
      documents: [
        {
          id: 11,
          category: "bloodwork",
          filename: "labs-may.pdf",
          extractedText:
            [
              "ApoB 72 mg/dL",
              "LDL-C 88 mg/dL",
              "hs-CRP 0.4 mg/L",
              "Ferritin 82 ng/mL",
              "Glucose 88 mg/dL",
            ].join("\n"),
        },
        {
          id: 12,
          category: "notes",
          filename: "history.md",
          extractedText:
            "Past history: chronic rhinitis. Current goals: lower ApoB and improve body composition.",
        },
        {
          id: 13,
          category: "wearables",
          filename: "watch.csv",
          extractedText: "sleep_hours,7.4",
        },
      ],
    });

    expect(profile).not.toBeNull();
    expect(profile?.summaryText).toContain("Clinical profile");
    expect(profile?.summaryText).toContain("labs-may.pdf");
    expect(profile?.summaryText).toContain("history.md");
    expect(profile?.summaryText).toContain("ApoB 72 mg/dL");
    expect(profile?.summaryText).toContain("Ferritin 82 ng/mL");
    expect(profile?.structuredData.sourceDocumentIds).toEqual([11, 12]);
    expect(profile?.structuredData.sections).toHaveLength(2);
    expect(profile?.structuredData.measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: 11,
          panel: "lipids",
          marker: "ApoB",
          value: "72",
          unit: "mg/dL",
        }),
        expect.objectContaining({
          documentId: 11,
          panel: "iron",
          marker: "Ferritin",
          value: "82",
          unit: "ng/mL",
        }),
      ]),
    );
    expect(profile?.structuredData.panels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ panel: "lipids" }),
        expect.objectContaining({ panel: "iron" }),
      ]),
    );
    expect(profile?.structuredData.documentSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: 11,
          filename: "labs-may.pdf",
          measurementCount: expect.any(Number),
        }),
      ]),
    );
  });

  it("returns null when there are no medical documents ready for profiling", () => {
    expect(
      buildClinicalProfile({
        documents: [
          {
            id: 30,
            category: "wearables",
            filename: "steps.csv",
            extractedText: "steps,9000",
          },
        ],
      }),
    ).toBeNull();
  });
});

describe("vault retrieval", () => {
  it("selects the most relevant chunks for the current question", () => {
    const chunks = buildVaultDocumentChunks({
      documentId: 81,
      content:
        "ApoB 72 mg/dL. LDL-C 88 mg/dL. Ferritin 82 ng/mL. Sleep is improving. Glucose 88 mg/dL.",
      chunkSize: 40,
    });

    const selected = selectVaultDocumentChunksForPrompt({
      query: "How is my ApoB looking?",
      chunks,
      maxChunks: 2,
    });

    expect(selected).toHaveLength(2);
    expect(selected[0]?.content.toLowerCase()).toContain("apob");
  });

  it("balances global bloodwork review chunks across documents and dense measurements", () => {
    const selected = selectVaultDocumentChunksForPrompt({
      query: "podes analizar del vault todos mis estudios de sangre",
      mode: "global_bloodwork_review",
      chunks: [
        {
          documentId: 1,
          chunkIndex: 0,
          content: "Hemoglobina\n15.3\ng/dL\n13.3 - 16.7\nHematocrito\n46\n%\n39 - 50",
        },
        {
          documentId: 1,
          chunkIndex: 1,
          content: "Encabezado del laboratorio y datos administrativos",
        },
        {
          documentId: 2,
          chunkIndex: 0,
          content: "Colesterol Total\n154\nmg/dL\nLDL Colesterol\n97\nmg/dL\nTriglicéridos\n92\nmg/dL",
        },
        {
          documentId: 3,
          chunkIndex: 0,
          content: "Ferritina\n44.6\nng/mL\nFerremia\n106\nµg/dL",
        },
      ],
      maxChunks: 3,
    });

    expect(selected).toHaveLength(3);
    expect(selected.map(chunk => chunk.documentId)).toEqual([1, 2, 3]);
    expect(selected[0]?.content).not.toContain("administrativos");
  });

  it("always keeps the clinical profile summary in context even without matching chunks", () => {
    const snippet = buildVaultContextSnippet({
      clinicalProfileSummary:
        "Clinical profile: ApoB has been improving and the user has chronic rhinitis.",
      selectedChunks: [],
    });

    expect(snippet).toContain("Clinical profile summary:");
    expect(snippet).toContain("ApoB has been improving");
    expect(snippet).not.toContain("Relevant vault excerpts:");
  });
});

describe("bloodwork extraction helpers", () => {
  it("extracts laboratory measurements from line-oriented lab text", () => {
    const measurements = extractBloodworkMeasurements({
      documentId: 41,
      filename: "bloodwork.pdf",
      content: [
        "Hemoglobina 14.2 g/dL",
        "Hematocrito 42.1 %",
        "Glucosa 88 mg/dL",
        "Ferritina 82 ng/mL",
      ].join("\n"),
    });

    expect(measurements).toEqual([
      expect.objectContaining({
        documentId: 41,
        panel: "cbc",
        marker: "Hemoglobina",
        value: "14.2",
        unit: "g/dL",
      }),
      expect.objectContaining({
        documentId: 41,
        panel: "cbc",
        marker: "Hematocrito",
        value: "42.1",
        unit: "%",
      }),
      expect.objectContaining({
        documentId: 41,
        panel: "glucose",
        marker: "Glucosa",
        value: "88",
        unit: "mg/dL",
      }),
      expect.objectContaining({
        documentId: 41,
        panel: "iron",
        marker: "Ferritina",
        value: "82",
        unit: "ng/mL",
      }),
    ]);
  });

  it("extracts measurements from vertical OCR tables and computes flags", () => {
    const measurements = extractBloodworkMeasurements({
      documentId: 42,
      filename: "vertical-labs.pdf",
      content: [
        "HEMOGRAMA COMPLETO",
        "Hemoglobina",
        "12.4",
        "g/dL",
        "13.3 - 16.7",
        "Ferritina",
        "18",
        "ng/mL",
        "30 - 400",
      ].join("\n"),
    });

    expect(measurements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marker: "Hemoglobina",
          flag: "low",
          referenceRange: "13.3 - 16.7",
        }),
        expect.objectContaining({
          marker: "Ferritina",
          flag: "low",
          referenceRange: "30 - 400",
        }),
      ]),
    );
  });
});

describe("extraction normalization", () => {
  it("unwraps Kimi JSON content and strips noisy wrappers", () => {
    const normalized = normalizeExtractedDocumentText(
      "{\"content\":\"<header>LAB</header>\\nHemoglobina\\n15.3\\ng/dL\\n<footer>page 1</footer>\"}",
    );

    expect(normalized.text).toContain("Hemoglobina");
    expect(normalized.text).toContain("15.3");
    expect(normalized.text).not.toContain("{\"content\"");
    expect(normalized.text).not.toContain("<header>");
    expect(normalized.normalizationApplied).toBe(true);
    expect(normalized.normalizedTextLength).toBeLessThan(normalized.rawTextLength);
  });
});

describe("query mode routing", () => {
  it("detects global bloodwork review requests", () => {
    expect(
      resolveVaultQueryMode({
        query: "podes analizar del vault todos mis estudios de sangre ?",
        allowedCategories: ["bloodwork"],
      }),
    ).toBe("global_bloodwork_review");

    expect(
      resolveVaultQueryMode({
        query: "como esta mi ferritina?",
        allowedCategories: ["bloodwork"],
      }),
    ).toBe("targeted_query");
  });
});

describe("remote extraction routing", () => {
  it("prefers Kimi extraction for PDFs and images", () => {
    expect(
      shouldUseKimiPrimaryExtraction("application/pdf", "labs.pdf"),
    ).toBe(true);
    expect(
      shouldUseKimiPrimaryExtraction("image/png", "lab-scan.png"),
    ).toBe(true);
    expect(
      shouldUseKimiPrimaryExtraction("text/plain", "notes.txt"),
    ).toBe(false);
  });
});

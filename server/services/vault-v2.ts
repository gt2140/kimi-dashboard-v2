import { createHash } from "node:crypto";

export type VaultDocumentCategory =
  | "bloodwork"
  | "genetics"
  | "wearables"
  | "body-composition"
  | "notes"
  | "other";

export type VaultDocumentStatus =
  | "uploaded"
  | "extracting"
  | "profiling"
  | "ready"
  | "failed";

export type VaultRunStatus = "queued" | "running" | "completed" | "failed";

export type VaultRunStage =
  | "store_original"
  | "extract_text"
  | "index_chunks"
  | "build_profile"
  | "sync_memory"
  | "completed";

export type VaultQueryMode = "targeted_query" | "global_bloodwork_review";

export type VaultDocumentChunk = {
  documentId: number;
  chunkIndex: number;
  content: string;
};

export type ClinicalProfileSection = {
  documentId: number;
  filename: string;
  category: VaultDocumentCategory;
  excerpt: string;
};

export type ClinicalMeasurement = {
  documentId: number;
  filename: string;
  panel: string;
  marker: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  flag: "low" | "high" | "normal" | "unknown";
  collectedAt: string | null;
};

export type ClinicalPanelSummary = {
  panel: string;
  measurementCount: number;
  documentIds: number[];
  markers: string[];
};

export type ClinicalDocumentSummary = {
  documentId: number;
  filename: string;
  category: VaultDocumentCategory;
  measurementCount: number;
  panelCount: number;
  categoryMismatch: boolean;
  qualityWarnings: string[];
};

export type ClinicalProfile = {
  summaryText: string;
  structuredData: {
    sourceDocumentIds: number[];
    sections: ClinicalProfileSection[];
    measurements: ClinicalMeasurement[];
    panels: ClinicalPanelSummary[];
    documentSummaries: ClinicalDocumentSummary[];
    qualityWarnings: string[];
  };
};

export type NormalizedExtractedText = {
  text: string;
  rawTextLength: number;
  normalizedTextLength: number;
  normalizationApplied: boolean;
  qualityWarnings: string[];
};

const MEDICAL_CATEGORIES = new Set<VaultDocumentCategory>([
  "bloodwork",
  "genetics",
  "body-composition",
  "notes",
]);

const BLOODWORK_REVIEW_PATTERNS = [
  /\btodos?\b.*\b(estudios?|analisis|análisis|labs?|laboratorios?)\b/i,
  /\banaliz[aá]\b.*\b(sangre|bloodwork|labs?)\b/i,
  /\bfrom the vault\b.*\b(blood|labs?)\b/i,
  /\boverall\b.*\b(blood|lab)\b/i,
  /\bvault\b.*\b(sangre|blood|labs?)\b/i,
];

const SPECIFIC_MARKER_HINTS = [
  "ferrit",
  "gluc",
  "insulin",
  "apob",
  "ldl",
  "hdl",
  "trig",
  "testoster",
  "shbg",
  "tsh",
  "t3",
  "t4",
  "vitamina",
  "vitamin",
  "homocist",
  "hs-crp",
  "crp",
  "ferr",
  "cbc",
  "cmp",
  "hemoglob",
  "hematoc",
];

const PANEL_KEYWORDS: Array<{
  panel: string;
  headings: string[];
  markers: string[];
}> = [
  {
    panel: "cbc",
    headings: ["hemograma", "serie eritrocitaria", "serie leucocitaria", "cbc"],
    markers: [
      "glóbulos rojos",
      "globulos rojos",
      "hematocrito",
      "hemoglobina",
      "vcm",
      "hcm",
      "chcm",
      "rdw",
      "plaquetas",
      "glóbulos blancos",
      "globulos blancos",
      "neutrófilos",
      "neutrofilos",
      "linfocitos",
      "monocitos",
      "eosinófilos",
      "eosinofilos",
      "basófilos",
      "basofilos",
      "eritrosedimentación",
      "eritrosedimentacion",
    ],
  },
  {
    panel: "lipids",
    headings: ["perfil lipídico", "perfil lipidico", "lipid", "lípidos", "lipidos"],
    markers: [
      "colesterol total",
      "hdl",
      "ldl",
      "no hdl",
      "non hdl",
      "triglicer",
      "apob",
      "apolipoprote",
      "castelli",
    ],
  },
  {
    panel: "iron",
    headings: ["hierro", "perfil férrico", "perfil ferrico", "metabolismo del hierro"],
    markers: [
      "ferremia",
      "ferritina",
      "ferritin",
      "transferrina",
      "tibc",
      "uibc",
      "saturación de transferrina",
      "saturacion de transferrina",
    ],
  },
  {
    panel: "glucose",
    headings: ["glucosa", "metabolismo de hidratos", "glucose"],
    markers: [
      "glucosa",
      "glucose",
      "glucemia",
      "hemoglobina glicosilada",
      "hba1c",
      "insulina",
      "homa",
    ],
  },
  {
    panel: "liver",
    headings: ["hepatograma", "función hepática", "funcion hepatica"],
    markers: [
      "gpt",
      "alat",
      "got",
      "asat",
      "fosfatasa alcalina",
      "fal",
      "ggt",
      "gamma glutamil",
      "bilirrubina",
    ],
  },
  {
    panel: "renal",
    headings: ["función renal", "funcion renal", "renal"],
    markers: [
      "urea",
      "creatinina",
      "filtrado glomerular",
      "clearance",
      "uricemia",
      "ácido úrico",
      "acido urico",
      "sodio",
      "potasio",
      "cloro",
      "magnesio",
      "fosfatemia",
    ],
  },
  {
    panel: "hormones",
    headings: ["perfil hormonal", "hormonas", "hormonal"],
    markers: [
      "testosterona",
      "shbg",
      "fsh",
      "lh",
      "estradiol",
      "prolactina",
      "cortisol",
      "dhea",
      "dheas",
      "tsh",
      "t4",
      "t3",
      "igf",
    ],
  },
  {
    panel: "inflammation",
    headings: ["inflamación", "inflamacion", "reactantes"],
    markers: [
      "pcr",
      "crp",
      "hs-crp",
      "eritrosedimentación",
      "eritrosedimentacion",
      "homociste",
    ],
  },
  {
    panel: "vitamins",
    headings: ["vitaminas", "micronutrientes"],
    markers: [
      "vitamina d",
      "vitamina b12",
      "cianocobalamina",
      "folato",
      "ácido fólico",
      "acido folico",
    ],
  },
];

const CATEGORY_MISMATCH_PATTERNS: Record<string, RegExp[]> = {
  other: [
    /\bsibo\b/i,
    /\blactulosa\b/i,
    /\bh2\b/i,
    /\bch4\b/i,
    /\bmuestra de aliento\b/i,
    /\bflatulencia\b/i,
    /\benterotipo\b/i,
    /\bmicrobiota\b/i,
    /\bgut\b/i,
  ],
};

const MARKER_STOP_PHRASES = [
  "resultado",
  "resultados",
  "unidad",
  "unidades",
  "valores de referencia",
  "intervalos de referencia",
  "intervalo de referencia",
  "metodo",
  "medicacion",
  "paciente",
  "protocolo",
  "pagina",
  "adultos",
  "ninos",
  "niños",
  "valor deseable",
  "valor limite",
  "valor elevado",
  "valor muy elevado",
  "optimo",
  "óptimo",
  "toxicidad",
  "determinaciones quimicas",
  "determinaciones enzimaticas",
  "hasta",
  "método",
];

export function isMedicalVaultCategory(category: VaultDocumentCategory) {
  return MEDICAL_CATEGORIES.has(category);
}

export function computeVaultDocumentContentHash(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

export function normalizeExtractedDocumentText(rawContent: string): NormalizedExtractedText {
  const raw = rawContent ?? "";
  let text = raw;
  const qualityWarnings: string[] = [];

  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.includes("\"content\"")) {
    try {
      const parsed = JSON.parse(trimmed) as { content?: unknown };
      if (typeof parsed.content === "string") {
        text = parsed.content;
      }
    } catch {
      qualityWarnings.push("failed_to_parse_kimi_json_wrapper");
    }
  }

  text = text
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/<header>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer>[\s\S]*?<\/footer>/gi, "")
    .replace(/<\/?(?:header|footer)>/gi, "")
    .replace(/\u003c/g, "<")
    .replace(/\u003e/g, ">")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  text = dedupeRepeatedLines(text);

  if (text.length < Math.max(32, raw.length * 0.1)) {
    qualityWarnings.push("very_low_normalized_text_length");
  }

  return {
    text,
    rawTextLength: raw.length,
    normalizedTextLength: text.length,
    normalizationApplied: text !== raw,
    qualityWarnings,
  };
}

export function buildVaultDocumentChunks(input: {
  documentId: number;
  content: string;
  chunkSize?: number;
}) {
  const normalized = normalizeChunkText(input.content);
  const chunkSize = Math.max(64, input.chunkSize ?? 1200);
  const chunks: VaultDocumentChunk[] = [];

  for (let start = 0, chunkIndex = 0; start < normalized.length; chunkIndex += 1) {
    const end = Math.min(normalized.length, start + chunkSize);
    let sliceEnd = end;

    if (end < normalized.length) {
      const newlineBreak = normalized.lastIndexOf("\n", end);
      const sentenceBreak = normalized.lastIndexOf(". ", end);
      const naturalBreak = Math.max(newlineBreak, sentenceBreak);
      if (naturalBreak > start + Math.floor(chunkSize * 0.5)) {
        sliceEnd = naturalBreak + (naturalBreak === newlineBreak ? 0 : 1);
      }
    }

    const content = normalized.slice(start, sliceEnd).trim();
    if (content) {
      chunks.push({
        documentId: input.documentId,
        chunkIndex,
        content,
      });
    }

    start = Math.max(sliceEnd, start + 1);
  }

  return chunks;
}

export function resolveVaultQueryMode(input: {
  query: string;
  allowedCategories: VaultDocumentCategory[];
}) {
  const normalized = input.query.trim().toLowerCase();
  const bloodworkFocused =
    input.allowedCategories.length === 1 && input.allowedCategories[0] === "bloodwork";

  const mentionsSpecificMarker = SPECIFIC_MARKER_HINTS.some(term =>
    normalized.includes(term),
  );
  const matchesGlobalReview = BLOODWORK_REVIEW_PATTERNS.some(pattern =>
    pattern.test(input.query),
  );

  if (bloodworkFocused && matchesGlobalReview && !mentionsSpecificMarker) {
    return "global_bloodwork_review" as const;
  }

  return "targeted_query" as const;
}

export function selectVaultDocumentChunksForPrompt(input: {
  query: string;
  chunks: VaultDocumentChunk[];
  maxChunks?: number;
  mode?: VaultQueryMode;
}) {
  const maxChunks = Math.max(1, input.maxChunks ?? 4);
  const mode = input.mode ?? "targeted_query";
  const queryTerms = tokenize(input.query);

  if (mode === "global_bloodwork_review") {
    return selectGlobalBloodworkChunks(input.chunks, maxChunks);
  }

  return [...input.chunks]
    .map(chunk => ({
      chunk,
      score: scoreChunk(chunk.content, queryTerms),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.chunk.documentId !== right.chunk.documentId) {
        return left.chunk.documentId - right.chunk.documentId;
      }
      return left.chunk.chunkIndex - right.chunk.chunkIndex;
    })
    .slice(0, maxChunks)
    .map(entry => entry.chunk);
}

export function buildClinicalProfile(input: {
  documents: Array<{
    id: number;
    category: VaultDocumentCategory;
    filename: string;
    extractedText: string | null;
  }>;
}) {
  const normalizedDocuments = input.documents.map(document => {
    const normalized = normalizeExtractedDocumentText(document.extractedText ?? "");
    const bloodworkSuggestion = inferBloodworkContentClassification({
      fileName: document.filename,
      content: normalized.text,
      currentCategory: document.category,
    });
    const measurements =
      document.category === "bloodwork"
        ? extractBloodworkMeasurements({
            documentId: document.id,
            filename: document.filename,
            content: normalized.text,
          })
        : [];

    return {
      ...document,
      normalizedText: normalized.text,
      normalizationWarnings: normalized.qualityWarnings,
      categoryMismatch: bloodworkSuggestion.categoryMismatch,
      measurements,
    };
  });

  const measurements = normalizedDocuments.flatMap(document => document.measurements);

  const sections = normalizedDocuments
    .filter(document => isMedicalVaultCategory(document.category))
    .map(document => {
      const excerpt = summarizeDocumentForProfile({
        category: document.category,
        filename: document.filename,
        extractedText: document.normalizedText,
        measurements: document.measurements,
        categoryMismatch: document.categoryMismatch,
      });
      if (!excerpt) {
        return null;
      }

      return {
        documentId: document.id,
        filename: document.filename,
        category: document.category,
        excerpt,
      } satisfies ClinicalProfileSection;
    })
    .filter((section): section is ClinicalProfileSection => Boolean(section));

  if (sections.length === 0) {
    return null;
  }

  const panelMap = new Map<string, ClinicalPanelSummary>();
  for (const measurement of measurements) {
    const existing = panelMap.get(measurement.panel);
    if (!existing) {
      panelMap.set(measurement.panel, {
        panel: measurement.panel,
        measurementCount: 1,
        documentIds: [measurement.documentId],
        markers: [measurement.marker],
      });
      continue;
    }

    existing.measurementCount += 1;
    if (!existing.documentIds.includes(measurement.documentId)) {
      existing.documentIds.push(measurement.documentId);
    }
    if (!existing.markers.includes(measurement.marker)) {
      existing.markers.push(measurement.marker);
    }
  }

  const documentSummaries = normalizedDocuments
    .filter(document => isMedicalVaultCategory(document.category))
    .map(document => ({
      documentId: document.id,
      filename: document.filename,
      category: document.category,
      measurementCount: document.measurements.length,
      panelCount: new Set(document.measurements.map(measurement => measurement.panel)).size,
      categoryMismatch: document.categoryMismatch,
      qualityWarnings: [
        ...document.normalizationWarnings,
        ...(document.categoryMismatch ? ["category_mismatch"] : []),
        ...(document.measurements.length === 0 && document.category === "bloodwork"
          ? ["no_structured_measurements"]
          : []),
      ],
    })) satisfies ClinicalDocumentSummary[];

  const qualityWarnings = Array.from(
    new Set(documentSummaries.flatMap(summary => summary.qualityWarnings)),
  );

  const summaryLines: string[] = ["Clinical profile summary:"];

  if (measurements.length > 0) {
    summaryLines.push("Parsed bloodwork measurements:");
    for (const document of documentSummaries.filter(
      summary => summary.category === "bloodwork" && !summary.categoryMismatch,
    )) {
      const documentMeasurements = measurements
        .filter(measurement => measurement.documentId === document.documentId)
        .slice(0, 6)
        .map(measurement => formatMeasurement(measurement))
        .join("; ");
      if (documentMeasurements) {
        summaryLines.push(`- ${document.filename}: ${documentMeasurements}`);
      }
    }

    const panels = [...panelMap.values()].sort((left, right) =>
      left.panel.localeCompare(right.panel),
    );
    if (panels.length > 0) {
      summaryLines.push("Panels available:");
      for (const panel of panels) {
        summaryLines.push(
          `- ${panel.panel}: ${panel.measurementCount} measurements across ${panel.documentIds.length} document(s)`,
        );
      }
    }
  }

  for (const section of sections.filter(section => section.category !== "bloodwork")) {
    summaryLines.push(`- ${section.category} | ${section.filename}: ${section.excerpt}`);
  }

  const lowConfidenceDocuments = documentSummaries.filter(
    summary => summary.qualityWarnings.length > 0,
  );
  if (lowConfidenceDocuments.length > 0) {
    summaryLines.push("Documents with low extraction confidence:");
    for (const summary of lowConfidenceDocuments) {
      summaryLines.push(`- ${summary.filename}: ${summary.qualityWarnings.join(", ")}`);
    }
  }

  return {
    summaryText: summaryLines.join("\n"),
    structuredData: {
      sourceDocumentIds: sections.map(section => section.documentId),
      sections,
      measurements,
      panels: [...panelMap.values()],
      documentSummaries,
      qualityWarnings,
    },
  } satisfies ClinicalProfile;
}

export function buildVaultContextSnippet(input: {
  clinicalProfileSummary: string | null;
  selectedChunks: VaultDocumentChunk[];
}) {
  const sections: string[] = [];

  if (input.clinicalProfileSummary?.trim()) {
    sections.push(`Clinical profile summary:\n${input.clinicalProfileSummary.trim()}`);
  }

  if (input.selectedChunks.length > 0) {
    sections.push(
      `Relevant vault excerpts:\n${input.selectedChunks
        .map(
          chunk =>
            `- [document ${chunk.documentId} chunk ${chunk.chunkIndex}] ${chunk.content}`,
        )
        .join("\n")}`,
    );
  }

  return sections.join("\n\n");
}

export function extractBloodworkMeasurements(input: {
  documentId: number;
  filename: string;
  content: string;
}) {
  const content = normalizeExtractedDocumentText(input.content).text;
  const lines = splitBloodworkLines(content);
  const measurements: ClinicalMeasurement[] = [];
  const seen = new Set<string>();
  const collectedAt = inferCollectedDate(content);
  let currentPanel = "general";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const panelFromHeading = detectBloodworkPanelHeading(line);
    if (panelFromHeading) {
      currentPanel = panelFromHeading;
      continue;
    }

    const inline = parseInlineMeasurement({
      line,
      panel: currentPanel,
      documentId: input.documentId,
      filename: input.filename,
      collectedAt,
    });
    if (inline) {
      pushUniqueMeasurement(measurements, seen, inline);
      continue;
    }

    if (!isPotentialMeasurementLabel(line, currentPanel)) {
      continue;
    }

    const vertical = parseVerticalMeasurement({
      lines,
      startIndex: index,
      panel: currentPanel,
      documentId: input.documentId,
      filename: input.filename,
      collectedAt,
    });

    if (!vertical) {
      continue;
    }

    pushUniqueMeasurement(measurements, seen, vertical.measurement);
    index = vertical.nextIndex;
  }

  for (let index = 0; index < lines.length - 2; index += 1) {
    const marker = cleanupBloodworkMarker(lines[index] ?? "");
    const valueLine = lines[index + 1] ?? "";
    const unitLine = lines[index + 2] ?? "";
    const rangeLine = lines[index + 3] ?? null;

    if (!isPlausibleMarkerName(marker) || !isNumericMeasurementValue(valueLine)) {
      continue;
    }
    if (!isLikelyUnit(unitLine)) {
      continue;
    }

    pushUniqueMeasurement(
      measurements,
      seen,
      buildMeasurement({
        documentId: input.documentId,
        filename: input.filename,
        marker,
        value: normalizeNumericValue(valueLine),
        unit: unitLine.trim(),
        referenceRange: rangeLine && isReferenceRangeLine(rangeLine)
          ? normalizeReferenceRange(rangeLine)
          : null,
        panel: normalizePanel(currentPanel, marker),
        collectedAt,
      }),
    );
  }

  return measurements.slice(0, 48);
}

function summarizeDocumentForProfile(input: {
  category: VaultDocumentCategory;
  filename: string;
  extractedText: string;
  measurements: ClinicalMeasurement[];
  categoryMismatch: boolean;
}) {
  if (input.category === "bloodwork") {
    if (input.categoryMismatch) {
      return `Document appears mislabeled for bloodwork review and was deprioritized: ${input.filename}`;
    }

    if (input.measurements.length > 0) {
      return input.measurements
        .slice(0, 8)
        .map(measurement => formatMeasurement(measurement))
        .join("; ");
    }
  }

  const excerptLimit = input.category === "notes" ? 280 : 360;
  return input.extractedText.slice(0, excerptLimit);
}

function formatMeasurement(measurement: ClinicalMeasurement) {
  const base = [measurement.marker, measurement.value, measurement.unit]
    .filter(Boolean)
    .join(" ");
  const rangePart = measurement.referenceRange
    ? ` (ref ${measurement.referenceRange})`
    : "";
  const flagPart =
    measurement.flag !== "unknown" ? ` [${measurement.flag}]` : "";
  return `${base}${rangePart}${flagPart}`;
}

function splitBloodworkLines(content: string) {
  return content
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function dedupeRepeatedLines(content: string) {
  const deduped: string[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) {
      if (deduped[deduped.length - 1] !== "") {
        deduped.push("");
      }
      continue;
    }

    if (deduped[deduped.length - 1] === line) {
      continue;
    }
    deduped.push(line);
  }

  return deduped.join("\n").trim();
}

function normalizeChunkText(content: string) {
  return normalizeExtractedDocumentText(content).text;
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9áéíóúüñµμ-]+/i)
    .map(term => term.trim())
    .filter(term => term.length > 1);
}

function scoreChunk(content: string, queryTerms: string[]) {
  const normalizedContent = content.toLowerCase();
  const measurementCount = extractBloodworkMeasurements({
    documentId: 0,
    filename: "chunk",
    content,
  }).length;

  return queryTerms.reduce((score, term) => {
    return score + (normalizedContent.includes(term) ? 2 : 0);
  }, measurementCount);
}

function selectGlobalBloodworkChunks(chunks: VaultDocumentChunk[], maxChunks: number) {
  const ranked = [...chunks]
    .map(chunk => ({
      chunk,
      score: scoreGlobalBloodworkChunk(chunk.content),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.chunk.documentId !== right.chunk.documentId) {
        return left.chunk.documentId - right.chunk.documentId;
      }
      return left.chunk.chunkIndex - right.chunk.chunkIndex;
    });

  const perDocument = new Map<number, number>();
  const selected: VaultDocumentChunk[] = [];

  for (const entry of ranked) {
    const currentCount = perDocument.get(entry.chunk.documentId) ?? 0;
    if (currentCount >= 2) {
      continue;
    }
    if (entry.score <= 0) {
      continue;
    }
    selected.push(entry.chunk);
    perDocument.set(entry.chunk.documentId, currentCount + 1);
    if (selected.length >= maxChunks) {
      break;
    }
  }

  if (selected.length >= maxChunks) {
    return selected.sort((left, right) => {
      if (left.documentId !== right.documentId) {
        return left.documentId - right.documentId;
      }
      return left.chunkIndex - right.chunkIndex;
    });
  }

  for (const entry of ranked) {
    if (selected.length >= maxChunks) {
      break;
    }
    if (selected.some(chunk => sameChunk(chunk, entry.chunk))) {
      continue;
    }
    selected.push(entry.chunk);
  }

  return selected.sort((left, right) => {
    if (left.documentId !== right.documentId) {
      return left.documentId - right.documentId;
    }
    return left.chunkIndex - right.chunkIndex;
  });
}

function sameChunk(left: VaultDocumentChunk, right: VaultDocumentChunk) {
  return left.documentId === right.documentId && left.chunkIndex === right.chunkIndex;
}

function scoreGlobalBloodworkChunk(content: string) {
  const measurementCount = extractBloodworkMeasurements({
    documentId: 0,
    filename: "chunk",
    content,
  }).length;
  const panelHits = countPanelSignals(content);
  const noisyAdministrativePenalty = /paciente|protocolo|documento|medico|médico|ingreso/i.test(
    content,
  )
    ? 2
    : 0;

  return measurementCount * 5 + panelHits * 2 - noisyAdministrativePenalty;
}

function countPanelSignals(content: string) {
  const normalized = normalizeText(content);
  return PANEL_KEYWORDS.reduce((count, panel) => {
    const matchesHeading = panel.headings.some(heading => normalized.includes(heading));
    const matchesMarker = panel.markers.some(marker => normalized.includes(marker));
    return count + (matchesHeading || matchesMarker ? 1 : 0);
  }, 0);
}

function parseInlineMeasurement(input: {
  line: string;
  panel: string;
  documentId: number;
  filename: string;
  collectedAt: string | null;
}) {
  const normalized = input.line.trim();
  if (!normalized || !/\d/.test(normalized)) {
    return null;
  }

  const pattern =
    /^(?<marker>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9()/%+.\- ]{1,80}?)\s*[:\-]?\s+(?<value>[<>]?\d+(?:[.,]\d+)?)\s*(?<unit>(?:[A-Za-zµμ%][A-Za-z0-9µμ/%^.\-]{0,18})|%)?(?:\s+(?:ref(?:erencia)?|rango|range|vr|vn)?\s*[:\-]?\s*(?<range>\d+(?:[.,]\d+)?\s*(?:-|a|to)\s*\d+(?:[.,]\d+)?(?:\s*[A-Za-zµμ%/^.]+)?))?$/i;

  const match = normalized.match(pattern);
  const marker = cleanupBloodworkMarker(match?.groups?.marker ?? "");
  const value = match?.groups?.value?.trim() ?? "";
  const unit = match?.groups?.unit?.trim() || null;
  const referenceRange = normalizeReferenceRange(match?.groups?.range ?? null);

  if (!marker || !value || !isPlausibleMarkerName(marker)) {
    return null;
  }
  if (!unit && !referenceRange) {
    return null;
  }

  return buildMeasurement({
    documentId: input.documentId,
    filename: input.filename,
    marker,
    value,
    unit,
    referenceRange,
    panel: normalizePanel(input.panel, marker),
    collectedAt: input.collectedAt,
  });
}

function parseVerticalMeasurement(input: {
  lines: string[];
  startIndex: number;
  panel: string;
  documentId: number;
  filename: string;
  collectedAt: string | null;
}) {
  const marker = cleanupBloodworkMarker(input.lines[input.startIndex] ?? "");
  let value: string | null = null;
  let unit: string | null = null;
  let range: string | null = null;
  let nextIndex = input.startIndex;

  for (let offset = 1; offset <= 5 && input.startIndex + offset < input.lines.length; offset += 1) {
    const candidate = input.lines[input.startIndex + offset]!;
    nextIndex = input.startIndex + offset;

    if (isMethodLine(candidate) || detectBloodworkPanelHeading(candidate)) {
      continue;
    }

    if (!value && isNumericMeasurementValue(candidate)) {
      value = normalizeNumericValue(candidate);
      continue;
    }

    if (value && !unit && isLikelyUnit(candidate)) {
      unit = candidate.trim();
      continue;
    }

    if (value && !range && isReferenceRangeLine(candidate)) {
      range = normalizeReferenceRange(candidate);
      continue;
    }
  }

  if (!value || (!unit && !range)) {
    return null;
  }

  return {
    measurement: buildMeasurement({
      documentId: input.documentId,
      filename: input.filename,
      marker,
      value,
      unit,
      referenceRange: range,
      panel: normalizePanel(input.panel, marker),
      collectedAt: input.collectedAt,
    }),
    nextIndex,
  };
}

function buildMeasurement(input: {
  documentId: number;
  filename: string;
  marker: string;
  value: string;
  unit: string | null;
  referenceRange: string | null;
  panel: string;
  collectedAt: string | null;
}) {
  return {
    documentId: input.documentId,
    filename: input.filename,
    panel: input.panel,
    marker: input.marker,
    value: input.value,
    unit: input.unit,
    referenceRange: input.referenceRange,
    flag: computeMeasurementFlag(input.value, input.referenceRange),
    collectedAt: input.collectedAt,
  } satisfies ClinicalMeasurement;
}

function pushUniqueMeasurement(
  target: ClinicalMeasurement[],
  seen: Set<string>,
  measurement: ClinicalMeasurement,
) {
  const key = [
    measurement.documentId,
    measurement.panel,
    measurement.marker.toLowerCase(),
    measurement.value,
    measurement.unit ?? "",
    measurement.referenceRange ?? "",
  ].join("|");
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  target.push(measurement);
}

function inferCollectedDate(content: string) {
  const match = content.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  return match?.[1] ?? null;
}

function inferBloodworkContentClassification(input: {
  fileName: string;
  content: string;
  currentCategory: VaultDocumentCategory;
}) {
  const normalized = normalizeText(`${input.fileName} ${input.content}`);
  const mismatch = CATEGORY_MISMATCH_PATTERNS.other.some(pattern => pattern.test(normalized));
  const measurementCount = extractBloodworkMeasurements({
    documentId: 0,
    filename: input.fileName,
    content: input.content,
  }).length;
  const bloodworkSignals = countPanelSignals(input.content);
  const categoryMismatch =
    input.currentCategory === "bloodwork" &&
    mismatch &&
    bloodworkSignals < 2 &&
    measurementCount < 3;

  return { categoryMismatch };
}

function normalizePanel(currentPanel: string, marker: string) {
  const inferred = inferPanelFromMarker(marker);
  if (inferred) {
    return inferred;
  }

  if (currentPanel !== "general") {
    return currentPanel;
  }

  return "general";
}

function detectBloodworkPanelHeading(line: string) {
  if (/\d/.test(line)) {
    return null;
  }

  const normalized = normalizeText(line);
  for (const definition of PANEL_KEYWORDS) {
    if (definition.headings.some(candidate => normalized.includes(candidate))) {
      return definition.panel;
    }
  }

  return null;
}

function isLikelyBloodworkMarker(value: string) {
  const normalized = normalizeText(value);
  if (!normalized || normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  if (/\d/.test(normalized)) {
    return false;
  }

  if (isMethodLine(value) || isReferenceRangeLine(value) || isLikelyUnit(value)) {
    return false;
  }

  return PANEL_KEYWORDS.some(
    definition =>
      definition.markers.some(marker => normalized.includes(marker)) ||
      definition.headings.some(heading => normalized.includes(heading)),
  );
}

function isPotentialMeasurementLabel(value: string, currentPanel: string) {
  if (isLikelyBloodworkMarker(value)) {
    return true;
  }

  const normalized = normalizeText(value);
  if (!isPlausibleMarkerName(value)) {
    return false;
  }

  return currentPanel !== "general" && normalized.length <= 32;
}

function isPlausibleMarkerName(value: string) {
  const normalized = normalizeText(value);
  if (!normalized || normalized.length < 2 || normalized.length > 80) {
    return false;
  }

  if (/^\d/.test(normalized) || isMethodLine(value) || isReferenceRangeLine(value) || isLikelyUnit(value)) {
    return false;
  }

  if (MARKER_STOP_PHRASES.some(phrase => normalized.includes(phrase))) {
    return false;
  }

  return /[a-z]/.test(normalized);
}

function inferPanelFromMarker(marker: string) {
  const normalizedMarker = normalizeText(marker);
  for (const definition of PANEL_KEYWORDS) {
    if (definition.markers.some(candidate => normalizedMarker.includes(candidate))) {
      return definition.panel;
    }
  }

  return null;
}

function isMethodLine(value: string) {
  return /^m[eé]todo/i.test(value.trim());
}

function isLikelyUnit(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed === "%") {
    return true;
  }

  if (/^10e\d+\/[A-Za-z]+$/i.test(trimmed)) {
    return true;
  }

  if (/[\/µμ]/.test(trimmed)) {
    return /^[A-Za-z0-9µμ/%^.\-]{2,20}$/i.test(trimmed);
  }

  return /^(?:pg|fl|gdl|gd\/l|g\/dl|mg|mgdl|mg\/dl|ng|ngml|ng\/ml|ui|ui\/l|ui\/ml|u\/l|iu\/l|mm|mmol\/l|pmol\/l|coi)$/i.test(
    trimmed.replace(/\s+/g, ""),
  );
}

function isReferenceRangeLine(value: string) {
  return /\d+(?:[.,]\d+)?\s*(?:-|a|to)\s*\d+(?:[.,]\d+)?/.test(value.trim());
}

function isNumericMeasurementValue(value: string) {
  return /^[<>]?\d+(?:[.,]\d+)?$/.test(value.trim());
}

function normalizeNumericValue(value: string) {
  return value.trim().replace(",", ".");
}

function normalizeReferenceRange(value: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/\s+/g, " ").trim();
}

function cleanupBloodworkMarker(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[._:;-]+$/g, "")
    .trim();
}

function computeMeasurementFlag(value: string, referenceRange: string | null) {
  if (!referenceRange) {
    return "unknown" as const;
  }

  const normalizedRange = referenceRange.replace(",", ".");
  const match = normalizedRange.match(
    /(?<min>\d+(?:\.\d+)?)\s*(?:-|a|to)\s*(?<max>\d+(?:\.\d+)?)/i,
  );
  if (!match?.groups) {
    return "unknown" as const;
  }

  const numericValue = Number.parseFloat(value.replace(",", ".").replace(/[<>]/g, ""));
  const min = Number.parseFloat(match.groups.min);
  const max = Number.parseFloat(match.groups.max);
  if (!Number.isFinite(numericValue) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return "unknown" as const;
  }

  if (numericValue < min) {
    return "low" as const;
  }
  if (numericValue > max) {
    return "high" as const;
  }
  return "normal" as const;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

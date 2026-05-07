export type VaultCategorySuggestion = {
  category: "bloodwork" | "genetics" | "wearables" | "body-composition" | "notes" | "other";
  confidence: number;
  reason: string;
  categoryMismatch: boolean;
};

export function inferVaultCategoryFromUpload(input: {
  fileName: string;
  mimeType: string;
}): VaultCategorySuggestion {
  const normalized = normalizeText(`${input.fileName} ${input.mimeType}`);

  if (hasAny(normalized, ["sibo", "lactulosa", "aliento", "ch4", "h2", "microbiota", "gut", "enterotipo"])) {
    return {
      category: "other",
      confidence: 0.9,
      reason: "Filename suggests gut or breath test content, not bloodwork.",
      categoryMismatch: false,
    };
  }

  if (hasAny(normalized, ["dexa", "inbody", "body composition", "masa muscular", "grasa corporal"])) {
    return {
      category: "body-composition",
      confidence: 0.9,
      reason: "Filename suggests body composition imaging/report.",
      categoryMismatch: false,
    };
  }

  if (hasAny(normalized, ["sangre", "blood", "laboratorio", "hemograma", "hormona", "ferrit", "lipid", "perfil lipid", "testosterona"])) {
    return {
      category: "bloodwork",
      confidence: 0.8,
      reason: "Filename suggests bloodwork or lab markers.",
      categoryMismatch: false,
    };
  }

  if (normalized.includes("csv")) {
    return {
      category: "wearables",
      confidence: 0.7,
      reason: "CSV uploads usually behave more like wearables or logs.",
      categoryMismatch: false,
    };
  }

  if (normalized.includes("txt") || normalized.includes("md")) {
    return {
      category: "notes",
      confidence: 0.7,
      reason: "Text documents usually behave like notes.",
      categoryMismatch: false,
    };
  }

  return {
    category: "other",
    confidence: 0.45,
    reason: "No strong category signal was detected from filename or mime type.",
    categoryMismatch: false,
  };
}

export function inferVaultCategorySuggestionFromContent(input: {
  fileName: string;
  mimeType: string;
  content: string;
  currentCategory: string;
}): VaultCategorySuggestion {
  const base = inferVaultCategoryFromUpload({
    fileName: input.fileName,
    mimeType: input.mimeType,
  });
  const normalized = normalizeText(`${input.fileName}\n${input.content}`);

  if (hasAny(normalized, ["sibo", "lactulosa", "muestra de aliento", "ch4", "h2", "microbiota", "enterotipo", "gut"])) {
    return {
      category: "other",
      confidence: 0.96,
      reason: "Content matches breath-test or gut-study patterns, not bloodwork.",
      categoryMismatch: input.currentCategory === "bloodwork",
    };
  }

  const bloodworkSignals = countMatches(normalized, [
    "hemograma",
    "hemoglobina",
    "hematocrito",
    "glucosa",
    "ferritina",
    "ferremia",
    "colesterol",
    "triglicer",
    "testosterona",
    "shbg",
    "tsh",
    "insulina",
  ]);

  if (bloodworkSignals >= 3) {
    return {
      category: "bloodwork",
      confidence: 0.9,
      reason: "Content contains multiple bloodwork markers and panels.",
      categoryMismatch: false,
    };
  }

  return {
    ...base,
    categoryMismatch: input.currentCategory !== base.category && base.category !== "other",
  };
}

function hasAny(input: string, candidates: string[]) {
  return candidates.some(candidate => input.includes(candidate));
}

function countMatches(input: string, candidates: string[]) {
  return candidates.reduce((count, candidate) => count + (input.includes(candidate) ? 1 : 0), 0);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

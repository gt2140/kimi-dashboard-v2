import { describe, expect, it } from "vitest";
import {
  CURATED_TEXT_MODELS,
  filterCuratedTextModels,
  getSelectedModelOption,
  resolveRuntimeModelSelection,
} from "./model-catalog";

describe("model catalog", () => {
  it("keeps the curated text-only list available for the chat picker", () => {
    expect(CURATED_TEXT_MODELS.map(model => model.displayName)).toEqual([
      "Auto",
      "GLM 5",
      "Venice Uncensored 1.2",
    ]);
  });

  it("filters the curated list by visible name and model id", () => {
    expect(filterCuratedTextModels("glm").map(model => model.displayName)).toEqual([
      "GLM 5",
    ]);

    expect(
      filterCuratedTextModels("venice-uncensored").map(model => model.displayName),
    ).toEqual(["Venice Uncensored 1.2"]);
  });

  it("resolves auto and explicit model selections consistently", () => {
    expect(getSelectedModelOption("auto", null)?.displayName).toBe("Auto");
    expect(
      getSelectedModelOption("venice", "zai-org-glm-5")?.displayName,
    ).toBe("GLM 5");
  });

  it("supports externally supplied model catalogs without losing auto resolution", () => {
    const models = [
      CURATED_TEXT_MODELS[0],
      {
        providerSlug: "venice" as const,
        modelName: "grok-4-20",
        displayName: "Grok 4.20",
        providerLabel: "Venice",
        modelId: "grok-4-20",
        contextWindow: "2M",
        badges: ["Private", "Reasoning", "Vision"],
        supportsReasoning: true,
        supportsVision: true,
        supportsCode: false,
        isDefaultCandidate: false,
      },
    ];

    expect(filterCuratedTextModels("grok", models)).toHaveLength(1);
    expect(getSelectedModelOption("venice", "grok-4-20", models)?.displayName).toBe(
      "Grok 4.20",
    );
    expect(getSelectedModelOption("auto", null, models)?.displayName).toBe("Auto");
  });

  it("shows persisted model selections that are missing from the live catalog", () => {
    const option = getSelectedModelOption("venice", "retired-venice-model", [
      CURATED_TEXT_MODELS[0],
    ]);

    expect(option).toMatchObject({
      providerSlug: "venice",
      modelName: "retired-venice-model",
      displayName: "retired-venice-model",
      providerLabel: "Venice",
      modelId: "retired-venice-model",
      badges: ["Unavailable"],
    });
  });

  it("routes Auto through the Venice default provider at request time", () => {
    expect(resolveRuntimeModelSelection("auto", null)).toEqual({
      requestedModelName: undefined,
    });

    expect(resolveRuntimeModelSelection("venice", "zai-org-glm-5")).toEqual({
      requestedModelName: "zai-org-glm-5",
    });
  });
});

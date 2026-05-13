import { describe, expect, it } from "vitest";
import {
  CURATED_TEXT_MODELS,
  filterCuratedTextModels,
  getSelectedModelOption,
} from "./model-catalog";

describe("model catalog", () => {
  it("keeps the curated text-only list available for the chat picker", () => {
    expect(CURATED_TEXT_MODELS.map(model => model.displayName)).toEqual([
      "Auto",
      "GLM 5.1",
      "GLM 5 Turbo",
      "GLM 4.7 Flash Heretic",
      "Venice Uncensored 1.2",
      "Qwen 3.6 Plus Uncensored",
      "Claude Sonnet 4.6",
      "GPT-5.5",
      "DeepSeek V4 Flash",
      "Kimi K2.6",
    ]);
  });

  it("filters the curated list by visible name and model id", () => {
    expect(
      filterCuratedTextModels("glm").map(model => model.displayName),
    ).toEqual(["GLM 5.1", "GLM 5 Turbo", "GLM 4.7 Flash Heretic"]);

    expect(
      filterCuratedTextModels("kimi-k2-6").map(model => model.displayName),
    ).toEqual(["Kimi K2.6"]);
  });

  it("resolves auto and explicit model selections consistently", () => {
    expect(getSelectedModelOption("auto", null)?.displayName).toBe("Auto");
    expect(
      getSelectedModelOption("venice", "zai-org-glm-5-1")?.displayName,
    ).toBe("GLM 5.1");
  });
});

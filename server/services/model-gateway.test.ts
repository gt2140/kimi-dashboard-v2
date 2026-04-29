import { describe, expect, it } from "vitest";
import { extractOpenAIResponseText } from "./model-gateway.js";

describe("extractOpenAIResponseText", () => {
  it("derives text from output content blocks when output_text is absent", () => {
    const text = extractOpenAIResponseText({
      output: [
        {
          content: [
            { type: "output_text", text: "Hello!" },
            { type: "other", text: "ignore me" },
          ],
        },
      ],
    });

    expect(text).toBe("Hello!");
  });

  it("prefers top-level output_text when present", () => {
    const text = extractOpenAIResponseText({
      output_text: "Top level text",
      output: [
        {
          content: [{ type: "output_text", text: "Nested text" }],
        },
      ],
    });

    expect(text).toBe("Top level text");
  });
});

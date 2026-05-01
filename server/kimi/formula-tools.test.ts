import { afterEach, describe, expect, it, vi } from "vitest";
import { KimiFormulaToolExecutor } from "./formula-tools.js";

describe("KimiFormulaToolExecutor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads official tools from the versioned formulas endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tools: [
          {
            type: "function",
            function: {
              name: "web_search",
            },
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const executor = new KimiFormulaToolExecutor();
    const tools = await executor.getEnabledTools(["moonshot/web-search:latest"]);

    expect(tools).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.moonshot.ai/v1/formulas/moonshot/web-search:latest/tools",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });
});

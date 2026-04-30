import { describe, expect, it } from "vitest";
import { withTimeout } from "./async-guard.js";

describe("withTimeout", () => {
  it("returns the original result when work finishes in time", async () => {
    await expect(
      withTimeout(Promise.resolve("ok"), {
        label: "fast task",
        timeoutMs: 50,
      })
    ).resolves.toBe("ok");
  });

  it("rejects with a readable timeout error when work takes too long", async () => {
    await expect(
      withTimeout(
        new Promise<string>((resolve) => {
          setTimeout(() => resolve("late"), 30);
        }),
        {
          label: "slow task",
          timeoutMs: 5,
        }
      )
    ).rejects.toThrow("slow task timed out after 5ms.");
  });
});

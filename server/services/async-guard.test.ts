import { describe, expect, it } from "vitest";
import { withAbortableTimeout, withTimeout } from "./async-guard.js";

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

describe("withAbortableTimeout", () => {
  it("returns the original result when work finishes in time", async () => {
    await expect(
      withAbortableTimeout(async () => "ok", {
        label: "fast abortable task",
        timeoutMs: 50,
      })
    ).resolves.toBe("ok");
  });

  it("does not abort the underlying task after a successful completion", async () => {
    let aborted = false;

    const result = await withAbortableTimeout(
      signal =>
        new Promise<string>((resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(signal.reason ?? new Error("aborted"));
          });

          setTimeout(() => resolve("ok"), 0);
        }),
      {
        label: "successful abortable task",
        timeoutMs: 50,
      }
    );

    expect(result).toBe("ok");
    expect(aborted).toBe(false);
  });

  it("aborts the underlying task when the timeout elapses", async () => {
    let aborted = false;

    await expect(
      withAbortableTimeout(
        signal =>
          new Promise<string>((resolve, reject) => {
            signal.addEventListener("abort", () => {
              aborted = true;
              reject(signal.reason ?? new Error("aborted"));
            });

            setTimeout(() => resolve("late"), 30);
          }),
        {
          label: "slow abortable task",
          timeoutMs: 5,
        }
      )
    ).rejects.toThrow("slow abortable task timed out after 5ms.");

    expect(aborted).toBe(true);
  });
});

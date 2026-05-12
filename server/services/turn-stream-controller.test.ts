import { describe, expect, it, vi } from "vitest";
import { TurnStreamController } from "./turn-stream-controller.js";

describe("TurnStreamController", () => {
  it("stops emitting when the downstream body is aborted", () => {
    const write = vi.fn(() => {
      throw new Error("BodyStreamBuffer was aborted");
    });
    const close = vi.fn(() => {
      throw new Error("BodyStreamBuffer was aborted");
    });
    const controller = new TurnStreamController({ write, close });

    expect(() =>
      controller.emitStage({
        id: "memory",
        label: "Loading context",
      }),
    ).not.toThrow();

    expect(() =>
      controller.complete({
        id: "1",
        role: "assistant",
        content: "ok",
        agentId: "generalist",
        createdAt: new Date().toISOString(),
      }),
    ).not.toThrow();

    expect(write).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  it("closes cleanly when the client disconnects before completion", () => {
    const write = vi.fn();
    const close = vi.fn();
    const controller = new TurnStreamController({ write, close });

    controller.disconnect();
    controller.emitDelta("hola");
    controller.fail({ message: "should stay quiet" });

    expect(write).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

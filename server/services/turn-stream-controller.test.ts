import { describe, expect, it } from "vitest";
import { TurnStreamController } from "./turn-stream-controller.js";

describe("TurnStreamController", () => {
  it("emits stage, delta, and only one terminal event", () => {
    const payloads: string[] = [];
    const controller = new TurnStreamController({
      write: (payload) => {
        payloads.push(payload);
      },
      close: () => {
        payloads.push("__closed__");
      },
    });

    controller.emitStage({
      id: "analyze",
      label: "Analyzing",
    });
    controller.emitDelta("Hello");
    controller.complete({
      id: "11",
      role: "assistant",
      content: "Hello world",
      agentId: "generalist",
      createdAt: "2026-04-30T23:00:00.000Z",
    });
    controller.fail("should be ignored");

    expect(payloads).toEqual([
      '{"type":"stage","stageId":"analyze","label":"Analyzing"}\n',
      '{"type":"text-delta","delta":"Hello"}\n',
      '{"type":"message-complete","message":{"id":"11","role":"assistant","content":"Hello world","agentId":"generalist","createdAt":"2026-04-30T23:00:00.000Z"}}\n',
      "__closed__",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  encodeChatStreamEvent,
  isRecoverableChatStreamStatus,
  parseChatStreamChunk,
} from "./chat-stream";

describe("chat-stream", () => {
  it("encodes events as newline-delimited json", () => {
    const payload = encodeChatStreamEvent({
      type: "stage",
      stageId: "analyze",
      label: "Mapping the full picture",
    });

    expect(payload.endsWith("\n")).toBe(true);
    expect(payload).toContain("\"type\":\"stage\"");
  });

  it("parses multiple events from a chunk and keeps incomplete remainder", () => {
    const first = encodeChatStreamEvent({
      type: "stage",
      stageId: "context",
      label: "Reviewing your context",
    });
    const second = encodeChatStreamEvent({
      type: "text-delta",
      delta: "Direct answer: ",
    });
    const third = encodeChatStreamEvent({
      type: "text-delta",
      delta: "Your panel looks solid.",
    });

    const combined = `${first}${second}${third}`;
    const cutIndex = combined.length - 9;
    const firstPass = parseChatStreamChunk(combined.slice(0, cutIndex));

    expect(firstPass.events).toHaveLength(2);
    expect(firstPass.remainder.length).toBeGreaterThan(0);

    const secondPass = parseChatStreamChunk(
      `${firstPass.remainder}${combined.slice(cutIndex)}`
    );

    expect(secondPass.events).toHaveLength(1);
    expect(secondPass.events[0]).toEqual({
      type: "text-delta",
      delta: "Your panel looks solid.",
    });
    expect(secondPass.remainder).toBe("");
  });

  it("marks missing or unsupported streaming endpoints as recoverable", () => {
    expect(isRecoverableChatStreamStatus(404)).toBe(true);
    expect(isRecoverableChatStreamStatus(405)).toBe(true);
    expect(isRecoverableChatStreamStatus(401)).toBe(false);
  });
});

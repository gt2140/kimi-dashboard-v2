import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createChatStreamWatchdog,
  encodeChatStreamEvent,
  isRecoverableChatStreamError,
  isRecoverableChatStreamStatus,
  parseChatStreamChunk,
} from "./chat-stream";

describe("chat-stream", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
    expect(isRecoverableChatStreamStatus(408)).toBe(true);
    expect(isRecoverableChatStreamStatus(429)).toBe(true);
    expect(isRecoverableChatStreamStatus(500)).toBe(true);
    expect(isRecoverableChatStreamStatus(503)).toBe(true);
    expect(isRecoverableChatStreamStatus(401)).toBe(false);
  });

  it("marks timeout, abort, and network stream failures as recoverable", () => {
    expect(
      isRecoverableChatStreamError(new Error("This operation was aborted"))
    ).toBe(true);
    expect(
      isRecoverableChatStreamError(
        new Error("BodyStreamBuffer was aborted")
      )
    ).toBe(true);
    expect(
      isRecoverableChatStreamError(
        new Error("Streaming request failed with HTTP 503.")
      )
    ).toBe(true);
    expect(
      isRecoverableChatStreamError(new Error("Failed to fetch"))
    ).toBe(true);
    expect(
      isRecoverableChatStreamError(new Error("Invalid authentication token."))
    ).toBe(false);
  });

  it("aborts a stalled chat stream after the inactivity timeout", () => {
    vi.useFakeTimers();

    const watchdog = createChatStreamWatchdog(5_000, "Chat stream");

    expect(watchdog.signal.aborted).toBe(false);

    vi.advanceTimersByTime(5_001);

    expect(watchdog.signal.aborted).toBe(true);
    expect(String(watchdog.signal.reason)).toContain(
      "Chat stream timed out after 5000ms."
    );
  });

  it("resets the inactivity timeout when the stream keeps moving", () => {
    vi.useFakeTimers();

    const watchdog = createChatStreamWatchdog(5_000, "Chat stream");

    vi.advanceTimersByTime(4_000);
    watchdog.touch();
    vi.advanceTimersByTime(4_000);

    expect(watchdog.signal.aborted).toBe(false);

    vi.advanceTimersByTime(1_100);

    expect(watchdog.signal.aborted).toBe(true);
  });

  it("allows a longer wait for the first byte before using the regular inactivity timeout", () => {
    vi.useFakeTimers();

    const watchdog = createChatStreamWatchdog(5_000, "Chat stream", {
      initialTimeoutMs: 20_000,
    });

    vi.advanceTimersByTime(10_000);

    expect(watchdog.signal.aborted).toBe(false);

    watchdog.touch();
    vi.advanceTimersByTime(4_000);

    expect(watchdog.signal.aborted).toBe(false);

    vi.advanceTimersByTime(1_100);

    expect(watchdog.signal.aborted).toBe(true);
    expect(String(watchdog.signal.reason)).toContain(
      "Chat stream timed out after 5000ms."
    );
  });

  it("does not abort after the watchdog is cancelled", () => {
    vi.useFakeTimers();

    const watchdog = createChatStreamWatchdog(5_000, "Chat stream");
    watchdog.cancel();
    vi.advanceTimersByTime(10_000);

    expect(watchdog.signal.aborted).toBe(false);
  });
});

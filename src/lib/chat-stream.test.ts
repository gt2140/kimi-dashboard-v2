import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMalformedStreamError,
  createChatStreamWatchdog,
  encodeChatStreamEvent,
  isRecoverableChatStreamError,
  isRecoverableChatStreamStatus,
  parseChatStreamChunk,
  readChatStreamResponseMetadata,
  shouldAttemptChatRecovery,
} from "./chat-stream";

describe("chat-stream", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("encodes events as newline-delimited json", () => {
    const payload = encodeChatStreamEvent({
      type: "ack",
      traceId: "trace-123",
    });

    expect(payload.endsWith("\n")).toBe(true);
    expect(payload).toContain("\"type\":\"ack\"");
  });

  it("parses multiple events from a chunk and keeps incomplete remainder", () => {
    const first = encodeChatStreamEvent({
      type: "ack",
      traceId: "trace-1",
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

  it("does not attempt persisted recovery for provider errors", () => {
    expect(shouldAttemptChatRecovery(503, "provider-error")).toBe(false);
    expect(shouldAttemptChatRecovery(503, "backend-timeout")).toBe(true);
    expect(shouldAttemptChatRecovery(401, "auth")).toBe(false);
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

  it("parses structured backend errors with category and trace id", () => {
    const payload = encodeChatStreamEvent({
      type: "error",
      message: "Primary response generation timed out after 25000ms.",
      category: "provider-timeout",
      traceId: "trace-789",
    });

    const parsed = parseChatStreamChunk(payload);

    expect(parsed.events).toEqual([
      {
        type: "error",
        message: "Primary response generation timed out after 25000ms.",
        category: "provider-timeout",
        traceId: "trace-789",
      },
    ]);
  });

  it("creates a structured error for malformed plain-text stream bodies", () => {
    const error = createMalformedStreamError({
      bodyPreview: "An error occurred",
      status: 200,
      contentType: "text/plain; charset=utf-8",
      traceId: "trace-stream",
    }) as Error & {
      category?: string;
      traceId?: string;
      bodyPreview?: string;
    };

    expect(error.message).toContain("Chat stream returned malformed content");
    expect(error.category).toBe("backend-timeout");
    expect(error.traceId).toBe("trace-stream");
    expect(error.bodyPreview).toBe("An error occurred");
  });

  it("creates a structured error for html stream bodies", () => {
    const error = createMalformedStreamError({
      bodyPreview: "<!doctype html><title>Error</title>",
      status: 502,
      contentType: "text/html",
    }) as Error & { category?: string };

    expect(error.category).toBe("backend-timeout");
  });

  it("reads stream response metadata without consuming the body", () => {
    const response = new Response("", {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "x-trace-id": "trace-header",
      },
    });

    expect(readChatStreamResponseMetadata(response)).toEqual({
      status: 200,
      contentType: "text/plain",
      traceId: "trace-header",
    });
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

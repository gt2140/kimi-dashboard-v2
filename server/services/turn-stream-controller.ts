import { encodeChatStreamEvent } from "../../src/lib/chat-stream.js";

type StreamWriter = {
  write: (payload: string) => void;
  close: () => void;
};

type StreamMessage = {
  id: string;
  role: "assistant";
  content: string;
  agentId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export class TurnStreamController {
  private terminal = false;
  private writerClosed = false;

  constructor(private readonly writer: StreamWriter) {}

  disconnect() {
    this.terminal = true;
    this.closeSafely();
  }

  emitStage(stage: { id: string; label: string }) {
    if (this.terminal) {
      return;
    }

    this.writeSafely(
      encodeChatStreamEvent({
        type: "stage",
        stageId: stage.id,
        label: stage.label,
      })
    );
  }

  emitDelta(delta: string) {
    if (this.terminal) {
      return;
    }

    this.writeSafely(
      encodeChatStreamEvent({
        type: "text-delta",
        delta,
      })
    );
  }

  complete(message: StreamMessage) {
    if (this.terminal) {
      return;
    }

    this.terminal = true;
    this.writeSafely(
      encodeChatStreamEvent({
        type: "message-complete",
        message,
      })
    );
    this.closeSafely();
  }

  fail(message: string) {
    if (this.terminal) {
      return;
    }

    this.terminal = true;
    this.writeSafely(
      encodeChatStreamEvent({
        type: "error",
        message,
      })
    );
    this.closeSafely();
  }

  private writeSafely(payload: string) {
    if (this.writerClosed) {
      return;
    }

    try {
      this.writer.write(payload);
    } catch {
      this.writerClosed = true;
    }
  }

  private closeSafely() {
    if (this.writerClosed) {
      return;
    }

    this.writerClosed = true;

    try {
      this.writer.close();
    } catch {
      // Ignore disconnect races from the HTTP body consumer.
    }
  }
}

import { encodeChatStreamEvent } from "../../src/lib/chat-stream.js";

type StreamWriter = {
  write: (payload: string) => Promise<void>;
  close: () => Promise<void>;
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

  async disconnect() {
    this.terminal = true;
    await this.closeSafely();
  }

  async emitStage(stage: { id: string; label: string }) {
    if (this.terminal) {
      return;
    }

    await this.writeSafely(
      encodeChatStreamEvent({
        type: "stage",
        stageId: stage.id,
        label: stage.label,
      })
    );
  }

  async emitDelta(delta: string) {
    if (this.terminal) {
      return;
    }

    await this.writeSafely(
      encodeChatStreamEvent({
        type: "text-delta",
        delta,
      })
    );
  }

  async complete(message: StreamMessage) {
    if (this.terminal) {
      return;
    }

    this.terminal = true;
    await this.writeSafely(
      encodeChatStreamEvent({
        type: "message-complete",
        message,
      })
    );
    await this.closeSafely();
  }

  async fail(message: string) {
    if (this.terminal) {
      return;
    }

    this.terminal = true;
    await this.writeSafely(
      encodeChatStreamEvent({
        type: "error",
        message,
      })
    );
    await this.closeSafely();
  }

  private async writeSafely(payload: string) {
    if (this.writerClosed) {
      return;
    }

    try {
      await this.writer.write(payload);
    } catch {
      this.writerClosed = true;
    }
  }

  private async closeSafely() {
    if (this.writerClosed) {
      return;
    }

    this.writerClosed = true;

    try {
      await this.writer.close();
    } catch {
      // Ignore disconnect races from the HTTP body consumer.
    }
  }
}

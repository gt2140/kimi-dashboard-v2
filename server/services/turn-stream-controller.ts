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

  constructor(private readonly writer: StreamWriter) {}

  emitStage(stage: { id: string; label: string }) {
    if (this.terminal) {
      return;
    }

    this.writer.write(
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

    this.writer.write(
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
    this.writer.write(
      encodeChatStreamEvent({
        type: "message-complete",
        message,
      })
    );
    this.writer.close();
  }

  fail(message: string) {
    if (this.terminal) {
      return;
    }

    this.terminal = true;
    this.writer.write(
      encodeChatStreamEvent({
        type: "error",
        message,
      })
    );
    this.writer.close();
  }
}

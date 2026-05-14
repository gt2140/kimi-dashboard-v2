import type { ChatModelSelection } from "@contracts/chat-models";
import {
  ModelGatewayService,
  type GenerateTextOutput,
  type GenerateTextInput,
  type StreamTextInput,
} from "./model-gateway.js";

export type AiProviderMessage = GenerateTextInput["messages"][number];

export type AiProviderRequest = {
  modelSelection: ChatModelSelection;
  systemPrompt?: string | null;
  signal?: AbortSignal | null;
  messages: AiProviderMessage[];
};

export type AiProviderStreamRequest = AiProviderRequest & {
  onTextDelta?: (delta: string) => void | Promise<void>;
};

export type AiProviderResult = GenerateTextOutput;

export type AiProviderGateway = {
  generateText(input: AiProviderRequest): Promise<AiProviderResult>;
  streamText(input: AiProviderStreamRequest): Promise<AiProviderResult>;
};

type ModelGatewayLike = Pick<ModelGatewayService, "generateText" | "streamText">;

function toModelGatewayInput(input: AiProviderRequest): GenerateTextInput {
  if (input.modelSelection.providerSlug === "auto") {
    throw new Error(
      "A concrete provider is required before executing a model request.",
    );
  }

  if (input.modelSelection.providerSlug === "kimi") {
    throw new Error(
      "Kimi execution is still handled by the Kimi runtime adapter.",
    );
  }

  return {
    providerSlug: input.modelSelection.providerSlug,
    modelName: input.modelSelection.modelName,
    systemPrompt: input.systemPrompt,
    signal: input.signal,
    messages: input.messages,
  };
}

function toModelGatewayStreamInput(
  input: AiProviderStreamRequest,
): StreamTextInput {
  return {
    ...toModelGatewayInput(input),
    onTextDelta: input.onTextDelta,
  };
}

export class ModelGatewayAiProviderGateway implements AiProviderGateway {
  private readonly modelGateway: ModelGatewayLike;

  constructor(dependencies: { modelGateway?: ModelGatewayLike } = {}) {
    this.modelGateway = dependencies.modelGateway ?? new ModelGatewayService();
  }

  async generateText(input: AiProviderRequest) {
    return this.modelGateway.generateText(toModelGatewayInput(input));
  }

  async streamText(input: AiProviderStreamRequest) {
    return this.modelGateway.streamText(toModelGatewayStreamInput(input));
  }
}

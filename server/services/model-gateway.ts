import { env } from "../lib/env.js";

export type GenerateTextInput = {
  providerSlug: string;
  modelName?: string | null;
  systemPrompt?: string | null;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
};

export type GenerateTextOutput = {
  text: string;
  providerSlug: string;
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

export function extractOpenAIResponseText(payload: OpenAIResponsePayload) {
  if (payload.output_text?.trim()) {
    return payload.output_text.trim();
  }

  const derived = (payload.output ?? [])
    .flatMap(item => item.content ?? [])
    .filter(item => item.type === "output_text" && typeof item.text === "string")
    .map(item => item.text!.trim())
    .filter(Boolean)
    .join("\n");

  return derived;
}

export class ModelGatewayService {
  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    if (input.providerSlug !== "openai") {
      throw new Error(
        `Provider ${input.providerSlug} is not connected yet. OpenAI is the first live provider in this MVP.`
      );
    }

    if (!env.openaiApiKey) {
      throw new Error(
        "OPENAI_API_KEY is missing. Add it to app/.env before using OpenAI generation."
      );
    }

    return this.generateWithOpenAI(input);
  }

  private async generateWithOpenAI(
    input: GenerateTextInput
  ): Promise<GenerateTextOutput> {
    const model = input.modelName || env.openaiModel;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: input.systemPrompt || undefined,
        input: input.messages.map(message => ({
          role: message.role,
          content: [
            {
              type: "input_text",
              text: message.content,
            },
          ],
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenAI request failed (${response.status}): ${body.slice(0, 500)}`
      );
    }

    const payload = (await response.json()) as OpenAIResponsePayload;
    const text = extractOpenAIResponseText(payload);

    if (!text.trim()) {
      throw new Error("OpenAI returned an empty output_text payload.");
    }

    return {
      text,
      providerSlug: "openai",
      modelName: model,
      inputTokens: payload.usage?.input_tokens,
      outputTokens: payload.usage?.output_tokens,
    };
  }
}

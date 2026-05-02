import { requestKimiChatCompletion } from "../server/services/kimi-chat-client.js";

async function main() {
  const started = Date.now();
  const reply = await requestKimiChatCompletion({
    systemPrompt: "You are a helpful assistant.",
    message:
      "Respond with a short confirmation that the backend can reach Kimi successfully.",
    userId: 1,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        ms: Date.now() - started,
        model: reply.model,
        finishReason: reply.finishReason,
        content: reply.content,
      },
      null,
      2,
    ),
  );
}

main().catch(error => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});

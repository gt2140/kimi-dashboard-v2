import { ensureConversationalCatalogSeeded } from "../server/queries/agents";
import { getDb } from "../server/queries/connection";
import { agentDefinitions, modelEndpoints, modelProviders } from "./schema";

async function seed() {
  console.log("Seeding conversational catalog...");
  await ensureConversationalCatalogSeeded();

  const db = getDb();
  const [providers, endpoints, agents] = await Promise.all([
    db.select().from(modelProviders),
    db.select().from(modelEndpoints),
    db.select().from(agentDefinitions),
  ]);

  console.log(
    JSON.stringify(
      {
        providers: providers.length,
        endpoints: endpoints.length,
        agents: agents.length,
      },
      null,
      2
    )
  );

  process.exit(0);
}

seed().catch(error => {
  console.error("Seed failed", error);
  process.exit(1);
});

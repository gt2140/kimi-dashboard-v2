import { eq } from "drizzle-orm";
import { modelEndpoints, modelProviders } from "../../db/schema.js";
import { getDb } from "../queries/connection.js";
import { ModelGatewayService } from "./model-gateway.js";

export type ResolvedExecutionTarget = {
  requestedProviderSlug: string | null;
  requestedModelName: string | null;
  providerSlug: string;
  modelName: string;
  executionNotes: string[];
  usedFallback: boolean;
};

export async function resolveExecutionTarget(params: {
  providerId: number | null;
  modelId: number | null;
}) {
  const db = getDb();
  const gateway = new ModelGatewayService();

  let requestedProviderSlug: string | null = null;
  let requestedModelName: string | null = null;
  const executionNotes: string[] = [];

  if (params.providerId) {
    const providerRows = await db
      .select({
        slug: modelProviders.slug,
      })
      .from(modelProviders)
      .where(eq(modelProviders.id, params.providerId))
      .limit(1);

    requestedProviderSlug = providerRows[0]?.slug ?? null;
  }

  if (params.modelId) {
    const endpointRows = await db
      .select({
        modelName: modelEndpoints.modelName,
        providerSlug: modelProviders.slug,
      })
      .from(modelEndpoints)
      .innerJoin(
        modelProviders,
        eq(modelEndpoints.providerId, modelProviders.id)
      )
      .where(eq(modelEndpoints.id, params.modelId))
      .limit(1);

    requestedModelName = endpointRows[0]?.modelName ?? null;
    requestedProviderSlug =
      requestedProviderSlug ?? endpointRows[0]?.providerSlug ?? null;
  }

  const defaultProviderSlug = "venice";
  const defaultModelName = gateway.getDefaultModel(defaultProviderSlug);
  const requestedOrDefaultProviderSlug =
    requestedProviderSlug ?? defaultProviderSlug;

  if (!gateway.supportsProvider(requestedOrDefaultProviderSlug)) {
    executionNotes.push(
      `Configured provider ${requestedOrDefaultProviderSlug} is not live yet, so this turn used ${defaultProviderSlug}.`
    );

    return {
      requestedProviderSlug,
      requestedModelName,
      providerSlug: defaultProviderSlug,
      modelName: defaultModelName,
      executionNotes,
      usedFallback: true,
    } satisfies ResolvedExecutionTarget;
  }

  return {
    requestedProviderSlug,
    requestedModelName,
    providerSlug: requestedOrDefaultProviderSlug,
    modelName:
      requestedModelName ??
      gateway.getDefaultModel(requestedOrDefaultProviderSlug),
    executionNotes,
    usedFallback: false,
  } satisfies ResolvedExecutionTarget;
}

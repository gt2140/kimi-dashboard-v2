import { env } from "../server/lib/env.js";
import { buildProductionReadinessPayload } from "../server/lib/production-readiness.js";

export default function handler(
  _request: { method?: string },
  response: { status: (code: number) => { json: (body: unknown) => void } }
) {
  response.status(200).json(buildProductionReadinessPayload(env));
}

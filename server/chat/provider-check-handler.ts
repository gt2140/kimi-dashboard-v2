import { classifyApiError } from "../lib/api-errors.js";
import { ModelGatewayService } from "../services/model-gateway.js";
import { authenticateRequest as defaultAuthenticateRequest } from "../trpc/auth.js";

type ProviderCheckDependencies = {
  authenticateRequest?: typeof defaultAuthenticateRequest;
  gateway?: Pick<ModelGatewayService, "diagnoseVenice">;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...(init ?? {}),
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export async function handleProviderCheckRequest(
  request: Request,
  dependencies: ProviderCheckDependencies = {}
) {
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse(
      {
        error: {
          message: "Method not allowed.",
          category: "transport",
        },
      },
      { status: 405 }
    );
  }

  const authenticateRequest =
    dependencies.authenticateRequest ?? defaultAuthenticateRequest;
  try {
    await authenticateRequest(request.headers);
  } catch (error) {
    const classified = classifyApiError(error);
    return jsonResponse(
      {
        error: {
          message: classified.message,
          category: classified.category,
        },
      },
      { status: 401 }
    );
  }

  const gateway = dependencies.gateway ?? new ModelGatewayService();
  const provider = await gateway.diagnoseVenice();

  return jsonResponse({ provider }, { status: 200 });
}

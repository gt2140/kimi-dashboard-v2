import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { incomingMessageToRequest } from "@trpc/server/adapters/node-http";
import { appRouter } from "../../server/trpc/router.js";
import { createContext } from "../../server/trpc/context.js";

function applyResponseHeaders(
  headers: Headers,
  response: {
    setHeader: (name: string, value: string | string[]) => void;
  }
) {
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      continue;
    }

    response.setHeader(key, value);
  }

  const getSetCookie = (headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie;

  if (typeof getSetCookie === "function") {
    const cookies = getSetCookie.call(headers);
    if (cookies.length > 0) {
      response.setHeader("set-cookie", cookies);
    }
  }
}

export default async function handler(
  req: Parameters<typeof incomingMessageToRequest>[0],
  res: Parameters<typeof incomingMessageToRequest>[1]
) {
  const request = incomingMessageToRequest(req, res, {
    maxBodySize: null,
  });

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext,
  });

  res.statusCode = response.status;
  applyResponseHeaders(response.headers, res);

  if (!response.body) {
    res.end();
    return;
  }

  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

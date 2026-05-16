import {
  toJsonErrorResponse,
  toNdjsonErrorEvent,
} from "./api-errors.js";

type NodeResponseLike = {
  statusCode?: number;
  setHeader?: (name: string, value: string | string[]) => void;
  end?: (body?: string | Buffer) => void;
};

function writeNodeResponse(
  res: NodeResponseLike | undefined,
  response: Response,
) {
  if (!res?.end) {
    return response;
  }

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader?.(key, value);
  });

  return response.arrayBuffer().then(body => {
    res.end?.(Buffer.from(body));
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapVercelJsonHandler<T extends (...args: any[]) => any>(
  handler: T,
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return writeNodeResponse(args[1] as NodeResponseLike | undefined, toJsonErrorResponse(error));
    }
  }) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapVercelNdjsonHandler<T extends (...args: any[]) => any>(
  handler: T,
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      const traceId = globalThis.crypto.randomUUID().slice(0, 8);
      const body = toNdjsonErrorEvent(error, traceId);
      const response = new Response(body, {
        status: 500,
        headers: {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store",
          "x-trace-id": traceId,
        },
      });

      return writeNodeResponse(args[1] as NodeResponseLike | undefined, response);
    }
  }) as T;
}

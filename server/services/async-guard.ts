type TimeoutOptions = {
  label: string;
  timeoutMs: number;
};

type AbortableTimeoutOptions = TimeoutOptions & {
  signal?: AbortSignal | null;
};

export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(`${options.label} timed out after ${options.timeoutMs}ms.`)
          );
        }, options.timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function withAbortableTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  options: AbortableTimeoutOptions
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let parentAbortListener: (() => void) | undefined;

  try {
    if (options.signal) {
      parentAbortListener = () => {
        controller.abort(
          options.signal?.reason ??
            new Error(`${options.label} was aborted before completion.`)
        );
      };

      if (options.signal.aborted) {
        parentAbortListener();
      } else {
        options.signal.addEventListener("abort", parentAbortListener, {
          once: true,
        });
      }
    }

    return await Promise.race([
      task(controller.signal),
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => {
            reject(
              controller.signal.reason ??
                new Error(`${options.label} was aborted before completion.`)
            );
          },
          { once: true }
        );
      }),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort(
            new Error(`${options.label} timed out after ${options.timeoutMs}ms.`)
          );
          reject(
            new Error(`${options.label} timed out after ${options.timeoutMs}ms.`)
          );
        }, options.timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (options.signal && parentAbortListener) {
      options.signal.removeEventListener("abort", parentAbortListener);
    }
  }
}

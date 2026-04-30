type TimeoutOptions = {
  label: string;
  timeoutMs: number;
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
  options: TimeoutOptions
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      task(controller.signal),
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
    controller.abort();
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

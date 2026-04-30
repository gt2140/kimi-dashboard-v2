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

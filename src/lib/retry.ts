/** Async delay/retry helpers shared by batch jobs that hit external services. */

/** Pause execution for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RetryOptions {
  /** Number of retries after the first attempt (so up to retries + 1 attempts). */
  retries: number;
  /** Base backoff delay; attempt N waits baseDelayMs * 2^N before retrying. */
  baseDelayMs: number;
}

/**
 * Run an async function, retrying on thrown errors with exponential backoff.
 * Rethrows the last error if every attempt fails. Functions that signal failure
 * by returning null should be wrapped to throw, so the retry can kick in.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < options.retries) {
        await sleep(options.baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastError;
}

/** Options for exponential backoff with full jitter. */
export interface BackoffOptions {
  readonly baseMs?: number;
  readonly maxMs?: number;
  readonly random?: () => number;
}

/** Backoff calculator. Jitter is not security related, random is injectable. */
export interface Backoff {
  nextMs(attempt: number): number;
}

/** Creates exponential backoff with full jitter, capped at maxMs. */
export function createBackoff(options: BackoffOptions = {}): Backoff {
  const base = options.baseMs ?? 1000;
  const max = options.maxMs ?? 30_000;
  const random = options.random ?? Math.random;
  return {
    nextMs(attempt: number): number {
      const cap = Math.min(max, base * 2 ** attempt);
      return Math.floor(random() * cap);
    },
  };
}

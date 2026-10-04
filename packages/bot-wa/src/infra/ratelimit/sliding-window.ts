/** Options for a sliding window burst counter. */
export interface SlidingWindowOptions {
  readonly windowMs: number;
  readonly max: number;
  readonly now?: () => number;
}

/** Outcome of recording one hit for a key. */
export interface WindowDecision {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
  readonly count: number;
}

/**
 * Sliding window counter for burst detection per key.
 * Stores timestamps of hits inside the window only.
 */
export class SlidingWindowCounter {
  private readonly stamps = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly now: () => number;

  constructor(options: SlidingWindowOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.now = options.now ?? (() => Date.now());
  }

  /** Records one hit for a key and reports whether it fits the window. */
  record(key: string): WindowDecision {
    const current = this.now();
    const cutoff = current - this.windowMs;
    const list = (this.stamps.get(key) ?? []).filter((stamp) => stamp > cutoff);
    if (list.length >= this.max) {
      this.stamps.set(key, list);
      const oldest = list[0] ?? current;
      return {
        allowed: false,
        retryAfterMs: Math.max(0, oldest + this.windowMs - current),
        count: list.length,
      };
    }
    list.push(current);
    this.stamps.set(key, list);
    return { allowed: true, retryAfterMs: 0, count: list.length };
  }

  /** Clears one key, used by tests and owner overrides. */
  reset(key: string): void {
    this.stamps.delete(key);
  }
}

/** Creates a sliding window counter. */
export function createSlidingWindowCounter(options: SlidingWindowOptions): SlidingWindowCounter {
  return new SlidingWindowCounter(options);
}

/** Options for a token bucket limiter. */
export interface TokenBucketOptions {
  readonly capacity: number;
  readonly refillPerMs: number;
  readonly now?: () => number;
  readonly initialTokens?: number;
}

/** Outcome of a consume attempt. */
export interface ConsumeResult {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
  readonly tokens: number;
}

/**
 * Token bucket rate limiter with injectable clock.
 * Tokens refill continuously at refillPerMs up to capacity.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;
  private readonly now: () => number;

  constructor(options: TokenBucketOptions) {
    this.capacity = options.capacity;
    this.refillPerMs = options.refillPerMs;
    this.now = options.now ?? (() => Date.now());
    this.tokens = options.initialTokens ?? options.capacity;
    this.last = this.now();
  }

  /** Tries to consume tokens. Reports wait time when denied. */
  tryConsume(count = 1): ConsumeResult {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return { allowed: true, retryAfterMs: 0, tokens: this.tokens };
    }
    const deficit = count - this.tokens;
    return {
      allowed: false,
      retryAfterMs: Math.ceil(deficit / this.refillPerMs),
      tokens: this.tokens,
    };
  }

  private refill(): void {
    const current = this.now();
    const elapsed = current - this.last;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
      this.last = current;
    }
  }
}

/** Creates a token bucket limiter. */
export function createTokenBucket(options: TokenBucketOptions): TokenBucket {
  return new TokenBucket(options);
}

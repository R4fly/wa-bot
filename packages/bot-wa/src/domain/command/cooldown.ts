/** Decision returned by a cooldown check. */
export interface CooldownDecision {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
}

/** Per key cooldown store with injectable clock for deterministic tests. */
export class CooldownStore {
  private readonly last = new Map<string, number>();
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  /** Checks and records usage for a key. Zero cooldown always allows. */
  check(key: string, cooldownMs: number): CooldownDecision {
    if (cooldownMs <= 0) {
      return { allowed: true, retryAfterMs: 0 };
    }
    const current = this.now();
    const previous = this.last.get(key);
    if (previous === undefined || current - previous >= cooldownMs) {
      this.last.set(key, current);
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: false, retryAfterMs: cooldownMs - (current - previous) };
  }

  /** Clears one key, used by tests and owner overrides. */
  reset(key: string): void {
    this.last.delete(key);
  }
}

/** Creates a cooldown store. */
export function createCooldownStore(now: () => number = () => Date.now()): CooldownStore {
  return new CooldownStore(now);
}

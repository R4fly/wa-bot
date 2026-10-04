import { describe, expect, it } from "vitest";
import { createTokenBucket } from "./token-bucket.js";

describe("TokenBucket", () => {
  it("should deny when capacity is exhausted and report retry time", () => {
    const time = 1000;
    const bucket = createTokenBucket({ capacity: 2, refillPerMs: 0.001, now: () => time });
    expect(bucket.tryConsume().allowed).toBe(true);
    expect(bucket.tryConsume().allowed).toBe(true);
    const third = bucket.tryConsume();
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("should allow again when time refills tokens", () => {
    let time = 1000;
    const bucket = createTokenBucket({ capacity: 1, refillPerMs: 0.001, now: () => time });
    expect(bucket.tryConsume().allowed).toBe(true);
    expect(bucket.tryConsume().allowed).toBe(false);
    time = 3000;
    expect(bucket.tryConsume().allowed).toBe(true);
  });

  it("should never exceed capacity when idle for a long time", () => {
    let time = 1000;
    const bucket = createTokenBucket({ capacity: 3, refillPerMs: 1, now: () => time });
    time = 1_000_000;
    expect(bucket.tryConsume(3).allowed).toBe(true);
    expect(bucket.tryConsume(1).allowed).toBe(false);
  });
});

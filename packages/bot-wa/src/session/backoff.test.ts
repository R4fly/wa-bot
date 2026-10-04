import { describe, expect, it } from "vitest";
import { createBackoff } from "./backoff.js";

describe("createBackoff", () => {
  it("should stay under the cap when attempt grows", () => {
    const backoff = createBackoff({ baseMs: 100, maxMs: 1000, random: () => 0.999 });
    expect(backoff.nextMs(0)).toBeLessThanOrEqual(100);
    expect(backoff.nextMs(10)).toBeLessThanOrEqual(1000);
  });

  it("should scale the cap exponentially when attempt increases", () => {
    const backoff = createBackoff({ baseMs: 100, maxMs: 100_000, random: () => 1 });
    expect(backoff.nextMs(0)).toBe(100);
    expect(backoff.nextMs(1)).toBe(200);
    expect(backoff.nextMs(2)).toBe(400);
  });

  it("should return zero when the injected random returns zero", () => {
    const backoff = createBackoff({ random: () => 0 });
    expect(backoff.nextMs(3)).toBe(0);
  });
});

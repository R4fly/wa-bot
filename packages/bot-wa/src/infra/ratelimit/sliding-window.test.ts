import { describe, expect, it } from "vitest";
import { createSlidingWindowCounter } from "./sliding-window.js";

describe("SlidingWindowCounter", () => {
  it("should deny when the window already holds max hits", () => {
    const time = 1000;
    const window = createSlidingWindowCounter({ windowMs: 500, max: 2, now: () => time });
    expect(window.record("u").allowed).toBe(true);
    expect(window.record("u").allowed).toBe(true);
    const third = window.record("u");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("should allow again when the oldest hit leaves the window", () => {
    let time = 1000;
    const window = createSlidingWindowCounter({ windowMs: 500, max: 1, now: () => time });
    expect(window.record("u").allowed).toBe(true);
    expect(window.record("u").allowed).toBe(false);
    time = 1600;
    expect(window.record("u").allowed).toBe(true);
  });

  it("should track keys independently when several keys record hits", () => {
    const time = 1000;
    const window = createSlidingWindowCounter({ windowMs: 500, max: 1, now: () => time });
    expect(window.record("a").allowed).toBe(true);
    expect(window.record("b").allowed).toBe(true);
    expect(window.record("a").allowed).toBe(false);
  });
});

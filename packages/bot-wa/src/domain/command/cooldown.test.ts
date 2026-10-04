import { describe, expect, it } from "vitest";
import { createCooldownStore } from "./cooldown.js";

describe("CooldownStore", () => {
  it("should block the second call when inside the cooldown window", () => {
    let time = 1000;
    const store = createCooldownStore(() => time);
    expect(store.check("u1", 500).allowed).toBe(true);
    time = 1200;
    const second = store.check("u1", 500);
    expect(second.allowed).toBe(false);
    expect(second.retryAfterMs).toBe(300);
  });

  it("should allow again when the window has passed", () => {
    let time = 1000;
    const store = createCooldownStore(() => time);
    store.check("u1", 500);
    time = 1600;
    expect(store.check("u1", 500).allowed).toBe(true);
  });

  it("should always allow when cooldown is zero", () => {
    const store = createCooldownStore(() => 0);
    expect(store.check("u1", 0).allowed).toBe(true);
    expect(store.check("u1", 0).allowed).toBe(true);
  });
});

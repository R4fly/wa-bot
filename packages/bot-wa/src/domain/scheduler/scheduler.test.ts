import { describe, expect, it } from "vitest";
import { ConfigError } from "../../kernel/errors/index.js";
import { createMemoryStorage } from "../../infra/storage/memory.js";
import type { Clock } from "../../types/internal.js";
import { cronMatches, parseCron } from "./cron.js";
import { createScheduler } from "./scheduler.js";

function manualClock(): Clock & { advance: (ms: number) => void } {
  let time = 0;
  const timers: Array<{ fn: () => void; at: number; dead: boolean }> = [];
  return {
    now: () => time,
    setTimeout(fn: () => void, ms: number): unknown {
      const entry = { fn, at: time + ms, dead: false };
      timers.push(entry);
      return entry;
    },
    clearTimeout(timer: unknown): void {
      (timer as { dead: boolean }).dead = true;
    },
    advance(ms: number): void {
      time += ms;
      for (const entry of [...timers]) {
        if (!entry.dead && entry.at <= time) {
          entry.dead = true;
          entry.fn();
        }
      }
    },
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}

describe("cron", () => {
  it("should parse step and list fields", () => {
    const fields = parseCron("*/15 1,2 * * 0-2");
    expect(fields?.minute).toEqual([0, 15, 30, 45]);
    expect(fields?.hour).toEqual([1, 2]);
    expect(fields?.dayOfWeek).toEqual([0, 1, 2]);
  });

  it("should reject malformed expressions", () => {
    expect(parseCron("* * *")).toBeNull();
    expect(parseCron("60 * * * *")).toBeNull();
  });

  it("should match a date in the given time zone", () => {
    const fields = parseCron("5 0 * * *");
    const date = new Date(Date.parse("2026-01-01T00:05:00Z"));
    expect(fields !== null && cronMatches(fields, date, "UTC")).toBe(true);
    expect(fields !== null && cronMatches(fields, date, "Asia/Jakarta")).toBe(false);
  });
});

describe("Scheduler", () => {
  it("should fire a delay job once and remove it from storage", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const runs: string[] = [];
    const scheduler = createScheduler({ storage, clock, tickMs: 100, run: async (id) => { runs.push(id); } });
    await scheduler.add({ id: "d1", kind: "delay", atMs: 250 });
    await scheduler.start();
    clock.advance(100);
    await flush();
    clock.advance(100);
    await flush();
    clock.advance(100);
    await flush();
    clock.advance(100);
    await flush();
    expect(runs).toEqual(["d1"]);
    expect(await storage.get("scheduler", "d1")).toBeUndefined();
    scheduler.stop();
  });

  it("should skip a fire when a lock is held by another instance", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const runs: string[] = [];
    const scheduler = createScheduler({ storage, clock, tickMs: 100, run: async (id) => { runs.push(id); } });
    await scheduler.add({ id: "i1", kind: "interval", everyMs: 100 });
    await storage.set("scheduler-lock", "i1", 1, { ttlMs: 10_000 });
    await scheduler.start();
    clock.advance(100);
    await flush();
    expect(runs).toEqual([]);
    scheduler.stop();
  });

  it("should retry a failing job and report after max retries", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    let calls = 0;
    const errors: number[] = [];
    const scheduler = createScheduler({
      storage,
      clock,
      tickMs: 100,
      run: async () => {
        calls += 1;
        throw new Error("boom");
      },
      onError: (_id, _error, attempts) => {
        errors.push(attempts);
      },
    });
    await scheduler.add({ id: "r1", kind: "delay", atMs: 50, maxRetries: 1 });
    await scheduler.start();
    for (let i = 0; i < 12; i += 1) {
      clock.advance(100);
      await flush();
    }
    expect(calls).toBe(2);
    expect(errors.length).toBe(1);
    scheduler.stop();
  });

  it("should fire an interval job repeatedly while the scheduler runs", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const runs: string[] = [];
    const scheduler = createScheduler({ storage, clock, tickMs: 100, run: async (id) => { runs.push(id); } });
    await scheduler.add({ id: "int1", kind: "interval", everyMs: 100 });
    await scheduler.start();
    for (let i = 0; i < 5; i += 1) {
      clock.advance(100);
      await flush();
    }
    expect(runs.length).toBeGreaterThanOrEqual(3);
    scheduler.stop();
  });

  it("should not fire a cron job when the lock is held by another instance", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const runs: string[] = [];
    const scheduler = createScheduler({ storage, clock, tickMs: 100, run: async (id) => { runs.push(id); } });
    await scheduler.add({ id: "c1", kind: "cron", expr: "* * * * *", timeZone: "UTC" });
    await storage.set("scheduler-lock", "c1", Date.now(), { ttlMs: 100_000 });
    await scheduler.start();
    clock.advance(100);
    await flush();
    expect(runs).toEqual([]);
    scheduler.stop();
  });

  it("should remove an interval job when remove is called and stop firing it", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const runs: string[] = [];
    const scheduler = createScheduler({ storage, clock, tickMs: 100, run: async (id) => { runs.push(id); } });
    await scheduler.add({ id: "int2", kind: "interval", everyMs: 100 });
    await scheduler.start();
    clock.advance(100);
    await flush();
    expect(runs.length).toBe(1);
    await scheduler.remove("int2");
    clock.advance(200);
    await flush();
    expect(runs.length).toBe(1);
    scheduler.stop();
  });

  it("should not start a second tick loop when start is called twice", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const runs: string[] = [];
    const scheduler = createScheduler({ storage, clock, tickMs: 100, run: async (id) => { runs.push(id); } });
    await scheduler.add({ id: "once", kind: "interval", everyMs: 100 });
    await scheduler.start();
    await scheduler.start();
    clock.advance(100);
    await flush();
    expect(runs.length).toBe(1);
    scheduler.stop();
  });

  it("should throw ConfigError when a cron job has an invalid expression", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const scheduler = createScheduler({ storage, clock, run: async () => undefined });
    await expect(scheduler.add({ id: "bad", kind: "cron", expr: "* *" })).rejects.toBeInstanceOf(ConfigError);
  });

  it("should throw ConfigError when an interval job lacks a positive everyMs", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const scheduler = createScheduler({ storage, clock, run: async () => undefined });
    await expect(scheduler.add({ id: "bad", kind: "interval" })).rejects.toBeInstanceOf(ConfigError);
  });

  it("should throw ConfigError when a delay job lacks atMs", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const scheduler = createScheduler({ storage, clock, run: async () => undefined });
    await expect(scheduler.add({ id: "bad", kind: "delay" })).rejects.toBeInstanceOf(ConfigError);
  });

  it("should remove the persisted spec when remove is called", async () => {
    const clock = manualClock();
    const storage = createMemoryStorage();
    const scheduler = createScheduler({ storage, clock, run: async () => undefined });
    await scheduler.add({ id: "gone", kind: "delay", atMs: 10 });
    expect(await scheduler.remove("gone")).toBe(true);
    expect(await storage.get("scheduler", "gone")).toBeUndefined();
  });
});
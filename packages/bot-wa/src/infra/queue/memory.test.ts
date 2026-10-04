import { describe, expect, it } from "vitest";
import { LifecycleError, RateLimitError } from "../../kernel/errors/index.js";
import type { Clock } from "../../types/internal.js";
import { createMemoryQueue } from "./memory.js";

function createManualClock(): Clock & { advance: (ms: number) => void } {
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
      for (const entry of timers) {
        if (!entry.dead && entry.at <= time) {
          entry.dead = true;
          entry.fn();
        }
      }
    },
  };
}

describe("createMemoryQueue", () => {
  it("should throw RateLimitError when enqueue exceeds maxLen", () => {
    const queue = createMemoryQueue<string>({ maxLen: 1, concurrency: 1 });
    queue.enqueue("a");
    expect(() => queue.enqueue("b")).toThrow(RateLimitError);
  });

  it("should run lower priority number first when jobs wait before start", async () => {
    const order: string[] = [];
    const queue = createMemoryQueue<string>({ maxLen: 10, concurrency: 1 });
    queue.enqueue("low", { priority: 10 });
    queue.enqueue("high", { priority: 1 });
    queue.start(async (job) => {
      order.push(job.payload);
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(["high", "low"]);
  });

  it("should remove a waiting job when cancel is called before start", () => {
    const ran: string[] = [];
    const queue = createMemoryQueue<string>({ maxLen: 10, concurrency: 1 });
    const id = queue.enqueue("a");
    expect(queue.cancel(id)).toBe(true);
    queue.start(async (job) => {
      ran.push(job.payload);
    });
    expect(ran).toEqual([]);
  });

  it("should dead letter a job after five consecutive failures when handler always throws", async () => {
    const clock = createManualClock();
    let calls = 0;
    const dead: string[] = [];
    const queue = createMemoryQueue<string>({
      maxLen: 10,
      concurrency: 1,
      clock,
      retryDelayMs: () => 10,
      onDeadLetter: (job) => {
        dead.push(job.id);
      },
    });
    queue.enqueue("boom");
    queue.start(async () => {
      calls += 1;
      throw new Error("fail");
    });
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
      clock.advance(20);
      await Promise.resolve();
    }
    expect(calls).toBe(5);
    expect(queue.deadLetters.length).toBe(1);
    expect(dead.length).toBe(1);
  });

  it("should throw LifecycleError when enqueue is called after stop", () => {
    const queue = createMemoryQueue<string>({ maxLen: 10, concurrency: 1 });
    queue.stop();
    expect(() => queue.enqueue("a")).toThrow(LifecycleError);
  });
});

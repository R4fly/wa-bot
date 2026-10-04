import { LifecycleError, RateLimitError } from "../../kernel/errors/index.js";
import { createSystemClock } from "../../kernel/lifecycle.js";
import type { Clock } from "../../types/internal.js";
import type { BoundedQueue, EnqueueOptions, QueueJob } from "./contract.js";

/** Options for the in-memory bounded queue driver. */
export interface MemoryQueueOptions<T> {
  readonly maxLen: number;
  readonly concurrency: number;
  readonly maxAttempts?: number;
  readonly retryDelayMs?: (attempt: number) => number;
  readonly clock?: Clock;
  readonly onDeadLetter?: (job: QueueJob<T>, attempts: number, error: unknown) => void;
}

interface WaitingJob<T> extends QueueJob<T> {
  attempt: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * In-memory bounded queue with priority, concurrency limit, retry with
 * backoff, cancel before start, and a dead letter queue after maxAttempts
 * consecutive failures. No unbounded buffers: enqueue throws RateLimitError
 * when the waiting list is full, and LifecycleError after stop.
 */
export function createMemoryQueue<T>(options: MemoryQueueOptions<T>): BoundedQueue<T> {
  const clock = options.clock ?? createSystemClock();
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelay =
    options.retryDelayMs ?? ((attempt: number) => Math.min(30_000, 100 * 2 ** attempt));
  const waiting: Array<WaitingJob<T>> = [];
  const dead: Array<QueueJob<T>> = [];
  let running = 0;
  let handler: ((job: QueueJob<T>) => Promise<void>) | null = null;
  let stopped = false;
  let sequence = 0;

  function pump(): void {
    if (handler === null || stopped) {
      return;
    }
    while (running < options.concurrency && waiting.length > 0) {
      waiting.sort((a, b) => a.priority - b.priority);
      const job = waiting.shift();
      if (job === undefined) {
        return;
      }
      running += 1;
      void runJob(job);
    }
  }

  async function runJob(job: WaitingJob<T>): Promise<void> {
    const active = handler;
    if (active === null) {
      running -= 1;
      return;
    }
    try {
      await active(job);
      running -= 1;
      pump();
    } catch (error) {
      running -= 1;
      const attempts = job.attempt + 1;
      if (attempts >= maxAttempts) {
        dead.push(job);
        if (options.onDeadLetter !== undefined) {
          options.onDeadLetter(job, attempts, error);
        }
      } else {
        const delay = retryDelay(attempts);
        clock.setTimeout(() => {
          if (!stopped) {
            waiting.push({ ...job, attempt: attempts });
            pump();
          }
        }, delay);
      }
      pump();
    }
  }

  return {
    enqueue(payload: T, enqueueOptions: EnqueueOptions = {}): string {
      if (stopped) {
        throw new LifecycleError({ message: "queue is stopped", context: {} });
      }
      if (waiting.length >= options.maxLen) {
        throw new RateLimitError({
          message: `queue full at ${options.maxLen} waiting jobs`,
          context: { maxLen: options.maxLen },
        });
      }
      sequence += 1;
      const id = enqueueOptions.id ?? `job-${sequence}`;
      waiting.push({ id, payload, priority: enqueueOptions.priority ?? 0, attempt: 0 });
      pump();
      return id;
    },
    cancel(jobId: string): boolean {
      const index = waiting.findIndex((job) => job.id === jobId);
      if (index === -1) {
        return false;
      }
      waiting.splice(index, 1);
      return true;
    },
    start(next: (job: QueueJob<T>) => Promise<void>): void {
      if (handler !== null) {
        throw new LifecycleError({ message: "queue already started", context: {} });
      }
      handler = next;
      pump();
    },
    stop(): void {
      stopped = true;
    },
    get size(): number {
      return waiting.length;
    },
    get deadLetters(): readonly QueueJob<T>[] {
      return dead;
    },
  };
}

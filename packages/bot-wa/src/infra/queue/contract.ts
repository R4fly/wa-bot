/** One unit of work in a queue. Lower priority number runs first. */
export interface QueueJob<T> {
  readonly id: string;
  readonly payload: T;
  readonly priority: number;
}

/** Options for enqueueing one job. */
export interface EnqueueOptions {
  readonly id?: string;
  readonly priority?: number;
}

/** Bounded queue contract. Full queue rejects with RateLimitError. */
export interface BoundedQueue<T> {
  enqueue(payload: T, options?: EnqueueOptions): string;
  cancel(jobId: string): boolean;
  start(handler: (job: QueueJob<T>) => Promise<void>): void;
  stop(): void;
  readonly size: number;
  readonly deadLetters: readonly QueueJob<T>[];
}

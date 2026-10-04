import { ConfigError } from "../../kernel/errors/index.js";
import type { StorageAdapter } from "../../infra/storage/contract.js";
import type { Clock } from "../../types/internal.js";
import { cronMatches, parseCron, type CronFields } from "./cron.js";

/** Kinds of scheduled jobs. */
export type SchedulerJobKind = "cron" | "interval" | "delay";

/** Persistent specification of one job. */
export interface SchedulerJobSpec {
  readonly id: string;
  readonly kind: SchedulerJobKind;
  readonly expr?: string;
  readonly everyMs?: number;
  readonly atMs?: number;
  readonly timeZone?: string;
  readonly maxRetries?: number;
}

/** Dependencies of the scheduler. Jobs run outside any message loop. */
export interface SchedulerDeps {
  readonly storage: StorageAdapter;
  readonly clock: Clock;
  readonly run: (jobId: string) => Promise<void>;
  readonly onError?: (jobId: string, error: unknown, attempts: number) => void;
  readonly tickMs?: number;
}

interface Runtime {
  readonly spec: SchedulerJobSpec;
  readonly fields: CronFields | null;
  lastFireMinute: number;
  lastRun: number;
  attempts: number;
  nextRetryAt: number;
  done: boolean;
}

const NAMESPACE = "scheduler";
const LOCK_NAMESPACE = "scheduler-lock";

/** Persistent scheduler with job locks and retry policy. */
export class Scheduler {
  private readonly deps: SchedulerDeps;
  private readonly runtimes = new Map<string, Runtime>();
  private timer: unknown = null;
  private started = false;
  private stopped = false;
  private ticking = false;

  constructor(deps: SchedulerDeps) {
    this.deps = deps;
  }

  /** Validates and persists one job specification. */
  async add(spec: SchedulerJobSpec): Promise<void> {
    if (spec.kind === "cron") {
      if (spec.expr === undefined || parseCron(spec.expr) === null) {
        throw new ConfigError({
          message: `invalid cron expression for job ${spec.id}`,
          context: { job: spec.id, expr: spec.expr ?? "" },
        });
      }
    }
    if (spec.kind === "interval" && (spec.everyMs === undefined || spec.everyMs <= 0)) {
      throw new ConfigError({
        message: `interval job ${spec.id} needs a positive everyMs`,
        context: { job: spec.id },
      });
    }
    if (spec.kind === "delay" && spec.atMs === undefined) {
      throw new ConfigError({
        message: `delay job ${spec.id} needs atMs`,
        context: { job: spec.id },
      });
    }
    await this.deps.storage.set(NAMESPACE, spec.id, spec);
    this.runtimes.set(spec.id, this.toRuntime(spec));
  }

  /** Removes one job from memory and storage. */
  async remove(jobId: string): Promise<boolean> {
    this.runtimes.delete(jobId);
    return this.deps.storage.delete(NAMESPACE, jobId);
  }

  /** Loads persisted jobs and starts the tick loop. */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    const keys = await this.deps.storage.keys(NAMESPACE);
    for (const key of keys) {
      const raw = await this.deps.storage.get(NAMESPACE, key);
      if (raw !== undefined && typeof raw === "object" && raw !== null) {
        const spec = raw as SchedulerJobSpec;
        if (!this.runtimes.has(spec.id)) {
          this.runtimes.set(spec.id, this.toRuntime(spec));
        }
      }
    }
    this.schedule();
  }

  /** Stops the tick loop. Running jobs finish on their own. */
  stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      this.deps.clock.clearTimeout(this.timer);
    }
  }

  private toRuntime(spec: SchedulerJobSpec): Runtime {
    return {
      spec,
      fields: spec.kind === "cron" && spec.expr !== undefined ? parseCron(spec.expr) : null,
      lastFireMinute: -1,
      lastRun: 0,
      attempts: 0,
      nextRetryAt: 0,
      done: false,
    };
  }

  private schedule(): void {
    if (this.stopped) {
      return;
    }
    this.timer = this.deps.clock.setTimeout(() => {
      void this.tick();
    }, this.deps.tickMs ?? 1000);
  }

  private async tick(): Promise<void> {
    if (this.stopped) {
      return;
    }
    if (!this.ticking) {
      this.ticking = true;
      const now = this.deps.clock.now();
      for (const runtime of [...this.runtimes.values()]) {
        await this.evaluate(runtime, now);
      }
      this.ticking = false;
    }
    this.schedule();
  }

  private async evaluate(runtime: Runtime, now: number): Promise<void> {
    if (runtime.done) {
      return;
    }
    if (runtime.nextRetryAt > 0) {
      if (now >= runtime.nextRetryAt) {
        runtime.nextRetryAt = 0;
        await this.fire(runtime, now);
      }
      return;
    }
    if (runtime.spec.kind === "cron") {
      const minuteIndex = Math.floor(now / 60_000);
      if (
        runtime.fields !== null &&
        runtime.lastFireMinute !== minuteIndex &&
        cronMatches(runtime.fields, new Date(now), runtime.spec.timeZone ?? "UTC")
      ) {
        runtime.lastFireMinute = minuteIndex;
        await this.fire(runtime, now);
      }
      return;
    }
    if (runtime.spec.kind === "interval") {
      const every = runtime.spec.everyMs ?? 0;
      if (now - runtime.lastRun >= every) {
        await this.fire(runtime, now);
      }
      return;
    }
    if (runtime.spec.atMs !== undefined && now >= runtime.spec.atMs && runtime.lastRun === 0) {
      const ok = await this.fire(runtime, now);
      if (ok) {
        runtime.done = true;
        await this.deps.storage.delete(NAMESPACE, runtime.spec.id);
      }
    }
  }

  private async fire(runtime: Runtime, now: number): Promise<boolean> {
    const locked = await this.deps.storage.has(LOCK_NAMESPACE, runtime.spec.id);
    if (locked) {
      return false;
    }
    await this.deps.storage.set(LOCK_NAMESPACE, runtime.spec.id, now, {
      ttlMs: (this.deps.tickMs ?? 1000) * 4,
    });
    try {
      await this.deps.run(runtime.spec.id);
      runtime.lastRun = now;
      runtime.attempts = 0;
      return true;
    } catch (error) {
      runtime.attempts += 1;
      const maxRetries = runtime.spec.maxRetries ?? 3;
      if (runtime.attempts <= maxRetries) {
        runtime.nextRetryAt = now + Math.min(30_000, 100 * 2 ** runtime.attempts);
      } else {
        if (this.deps.onError !== undefined) {
          this.deps.onError(runtime.spec.id, error, runtime.attempts);
        }
        runtime.attempts = 0;
        if (runtime.spec.kind === "delay") {
          runtime.done = true;
        }
      }
      return false;
    } finally {
      await this.deps.storage.delete(LOCK_NAMESPACE, runtime.spec.id);
    }
  }
}

/** Creates a persistent scheduler. */
export function createScheduler(deps: SchedulerDeps): Scheduler {
  return new Scheduler(deps);
}

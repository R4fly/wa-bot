import { DEFAULT_TRANSITION_TIMEOUT_MS } from "@baehaqirafly3/bot-wa-shared";
import type { AuditEntry, AuditSink, Clock } from "../types/internal.js";
import { BaseError, LifecycleError, TimeoutError } from "./errors/index.js";

/** All lifecycle states, in blueprint order. */
export const LIFECYCLE_STATES = [
  "idle",
  "config_loading",
  "config_ready",
  "container_building",
  "container_ready",
  "storage_connecting",
  "storage_ready",
  "logger_ready",
  "plugin_discovering",
  "plugin_verifying",
  "plugin_loading",
  "plugin_ready",
  "engine_initializing",
  "engine_connecting",
  "auth_pending",
  "auth_ready",
  "session_ready",
  "running",
  "draining",
  "stopped",
  "failed",
] as const;

/** One lifecycle state. */
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

/** Event emitted on every committed or failed transition. */
export interface TransitionEvent {
  readonly from: LifecycleState;
  readonly to: LifecycleState;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly result: "ok" | "error";
}

/** Listener for transition events. */
export type TransitionListener = (event: TransitionEvent) => void;

/** Dependencies injected into the lifecycle so time and audit are testable. */
export interface LifecycleDeps {
  readonly clock: Clock;
  readonly audit: AuditSink;
  readonly defaultTimeoutMs?: number;
}

/** System clock backed by global timers. Created lazily, no module side effects. */
export function createSystemClock(): Clock {
  return {
    now(): number {
      return Date.now();
    },
    setTimeout(fn: () => void, ms: number): unknown {
      return setTimeout(fn, ms);
    },
    clearTimeout(timer: unknown): void {
      clearTimeout(timer as NodeJS.Timeout);
    },
  };
}

const ALLOWED: Record<LifecycleState, readonly LifecycleState[]> = {
  idle: ["config_loading"],
  config_loading: ["config_ready", "failed"],
  config_ready: ["container_building", "failed"],
  container_building: ["container_ready", "failed"],
  container_ready: ["storage_connecting", "failed"],
  storage_connecting: ["storage_ready", "failed"],
  storage_ready: ["logger_ready", "failed"],
  logger_ready: ["plugin_discovering", "failed"],
  plugin_discovering: ["plugin_verifying", "failed"],
  plugin_verifying: ["plugin_loading", "failed"],
  plugin_loading: ["plugin_ready", "failed"],
  plugin_ready: ["engine_initializing", "failed"],
  engine_initializing: ["engine_connecting", "failed"],
  engine_connecting: ["auth_pending", "failed"],
  auth_pending: ["auth_ready", "failed"],
  auth_ready: ["session_ready", "failed"],
  session_ready: ["running", "failed"],
  running: ["draining", "failed"],
  draining: ["stopped", "failed"],
  stopped: [],
  failed: [],
};

/**
 * Deterministic lifecycle state machine. No backward transitions
 * except failed to idle via explicit restart. Every transition emits
 * an event and writes an audit entry.
 */
export class Lifecycle {
  private state: LifecycleState = "idle";
  private readonly listeners: TransitionListener[] = [];
  private readonly deps: LifecycleDeps;

  constructor(deps: LifecycleDeps) {
    this.deps = deps;
  }

  /** Current state. */
  get current(): LifecycleState {
    return this.state;
  }

  /** Subscribes to transition events. Returns an unsubscribe function. */
  subscribe(listener: TransitionListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Runs optional work under a timeout, then commits the transition to `to`.
   * On work failure or timeout the machine enters failed and the error is rethrown.
   */
  async runTransition(
    to: LifecycleState,
    work?: () => Promise<void>,
    options?: { readonly timeoutMs?: number; readonly correlationId?: string },
  ): Promise<void> {
    const from = this.state;
    const correlationId = options?.correlationId ?? "lifecycle";
    if (!ALLOWED[from].includes(to)) {
      throw new LifecycleError({
        message: `illegal lifecycle transition from ${from} to ${to}`,
        context: { from, to },
        correlationId,
      });
    }
    const timeoutMs = options?.timeoutMs ?? this.deps.defaultTimeoutMs ?? DEFAULT_TRANSITION_TIMEOUT_MS;

    if (work !== undefined) {
      try {
        await this.withTimeout(work, timeoutMs, correlationId);
      } catch (cause) {
        this.commit(from, "failed", correlationId, "error");
        throw cause;
      }
    }
    this.commit(from, to, correlationId, "ok");
  }

  /** Explicit restart from failed back to idle. The only backward transition. */
  restart(correlationId?: string): void {
    const id = correlationId ?? "lifecycle";
    if (this.state !== "failed") {
      throw new LifecycleError({
        message: `restart only allowed from failed, current state is ${this.state}`,
        context: { from: this.state, to: "idle" },
        correlationId: id,
      });
    }
    this.commit(this.state, "idle", id, "ok");
  }

  private withTimeout(work: () => Promise<void>, timeoutMs: number, correlationId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = this.deps.clock.setTimeout(() => {
        reject(
          new TimeoutError({
            message: `lifecycle work exceeded ${timeoutMs} ms`,
            context: { timeoutMs, state: this.state },
            correlationId,
          }),
        );
      }, timeoutMs);
      work().then(
        (value) => {
          this.deps.clock.clearTimeout(timer);
          resolve(value);
        },
        (cause) => {
          this.deps.clock.clearTimeout(timer);
          reject(cause instanceof BaseError ? cause : new LifecycleError({ message: "lifecycle work failed", cause, correlationId }));
        },
      );
    });
  }

  private commit(from: LifecycleState, to: LifecycleState, correlationId: string, result: "ok" | "error"): void {
    this.state = to;
    const timestamp = new Date(this.deps.clock.now()).toISOString();
    const event: TransitionEvent = { from, to, timestamp, correlationId, result };
    for (const listener of this.listeners) {
      listener(event);
    }
    const entry: AuditEntry = {
      timestamp,
      actor: "lifecycle",
      action: `transition:${to}`,
      target: "bot",
      result,
      correlationId,
      metadata: { from },
    };
    this.deps.audit.write(entry);
  }
}

/** Creates a lifecycle with injected clock and audit sink. */
export function createLifecycle(deps: LifecycleDeps): Lifecycle {
  return new Lifecycle(deps);
}

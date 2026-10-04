import type { Clock } from "../types/internal.js";

/** Dependencies of the periodic health monitor. */
export interface HealthMonitorDeps {
  readonly clock: Clock;
  readonly intervalMs: number;
  readonly check: () => Promise<boolean>;
  readonly onUnhealthy: (consecutiveFailures: number) => void;
  readonly onHealthy?: () => void;
}

/** Periodic health check with consecutive failure counting. */
export interface HealthMonitor {
  start(): void;
  stop(): void;
  readonly healthy: boolean;
  readonly failures: number;
}

/** Creates a health monitor. The check runs outside any message loop. */
export function createHealthMonitor(deps: HealthMonitorDeps): HealthMonitor {
  let timer: unknown = null;
  let failures = 0;
  let healthy = true;
  let stopped = false;

  function schedule(): void {
    timer = deps.clock.setTimeout(() => {
      void tick();
    }, deps.intervalMs);
  }

  async function tick(): Promise<void> {
    if (stopped) {
      return;
    }
    let ok = false;
    try {
      ok = await deps.check();
    } catch {
      ok = false;
    }
    if (ok) {
      if (!healthy && deps.onHealthy !== undefined) {
        deps.onHealthy();
      }
      healthy = true;
      failures = 0;
    } else {
      healthy = false;
      failures += 1;
      deps.onUnhealthy(failures);
    }
    schedule();
  }

  return {
    start(): void {
      if (!stopped) {
        schedule();
      }
    },
    stop(): void {
      stopped = true;
      if (timer !== null) {
        deps.clock.clearTimeout(timer);
      }
    },
    get healthy(): boolean {
      return healthy;
    },
    get failures(): number {
      return failures;
    },
  };
}

import type { EngineAdapter, NormalizedEvent } from "../adapters/contract.js";
import { SessionError } from "../kernel/errors/index.js";
import type { AuditSink, Clock } from "../types/internal.js";
import type { AuthStateStore } from "./auth-state.js";
import { createBackoff, type Backoff } from "./backoff.js";

/** Observable status of one managed session. */
export type SessionStatus = "running" | "reconnecting" | "stopped";

/** Snapshot of one managed session. */
export interface SessionInfo {
  readonly name: string;
  readonly status: SessionStatus;
  readonly reconnectAttempts: number;
}

/** Dependencies of the session manager. All time and audit are injected. */
export interface SessionManagerDeps {
  readonly clock: Clock;
  readonly audit: AuditSink;
  readonly authStoreFor: (sessionName: string) => AuthStateStore;
  readonly maxReconnectAttempts?: number;
  readonly backoff?: Backoff;
}

interface Managed {
  readonly adapter: EngineAdapter;
  unsubscribe: () => void;
  status: SessionStatus;
  attempts: number;
  reconnectTimer: unknown;
  killed: boolean;
}

/**
 * Manages session lifecycles over engine adapters.
 * One failing session never stops another. Reconnect uses exponential
 * backoff with jitter and gives up after maxReconnectAttempts.
 */
export class SessionManager {
  private readonly sessions = new Map<string, Managed>();
  private readonly deps: SessionManagerDeps;

  constructor(deps: SessionManagerDeps) {
    this.deps = deps;
  }

  /** Loads saved auth state, wires events, and connects one session. */
  async start(name: string, adapter: EngineAdapter): Promise<void> {
    if (this.sessions.has(name)) {
      throw new SessionError({
        message: `session already started: ${name}`,
        context: { session: name },
      });
    }
    const store = this.deps.authStoreFor(name);
    const saved = await store.load();
    if (saved !== undefined) {
      await adapter.setAuthState(saved);
    }
    const managed: Managed = {
      adapter,
      unsubscribe: () => undefined,
      status: "stopped",
      attempts: 0,
      reconnectTimer: null,
      killed: false,
    };
    managed.unsubscribe = adapter.onEvent((event) => {
      this.onEvent(name, event);
    });
    this.sessions.set(name, managed);
    await adapter.connect();
    managed.status = "running";
    this.writeAudit(name, "session:start", "ok");
  }

  /** Stops one session and cancels its reconnect loop. Kill switch. */
  async stop(name: string): Promise<void> {
    const managed = this.sessions.get(name);
    if (managed === undefined) {
      throw new SessionError({
        message: `session not found: ${name}`,
        context: { session: name },
      });
    }
    managed.killed = true;
    if (managed.reconnectTimer !== null) {
      this.deps.clock.clearTimeout(managed.reconnectTimer);
    }
    managed.unsubscribe();
    await managed.adapter.disconnect();
    this.sessions.delete(name);
    this.writeAudit(name, "session:stop", "ok");
  }

  /** Lists all managed sessions. */
  list(): readonly SessionInfo[] {
    return [...this.sessions.entries()].map(([name, managed]) => ({
      name,
      status: managed.status,
      reconnectAttempts: managed.attempts,
    }));
  }

  private onEvent(name: string, event: NormalizedEvent): void {
    const managed = this.sessions.get(name);
    if (managed === undefined) {
      return;
    }
    if (event.kind === "auth" && event.status === "ready") {
      void managed.adapter
        .getAuthState()
        .then((state) => this.deps.authStoreFor(name).save(state))
        .catch(() => undefined);
    }
    if (event.kind === "connection" && event.status === "disconnected" && !managed.killed) {
      this.scheduleReconnect(name);
    }
  }

  private scheduleReconnect(name: string): void {
    const managed = this.sessions.get(name);
    if (managed === undefined || managed.killed) {
      return;
    }
    const max = this.deps.maxReconnectAttempts ?? 5;
    if (managed.attempts >= max) {
      managed.status = "stopped";
      this.writeAudit(name, "session:reconnect-exhausted", "error");
      return;
    }
    const backoff = this.deps.backoff ?? createBackoff();
    const delay = backoff.nextMs(managed.attempts);
    managed.attempts += 1;
    managed.status = "reconnecting";
    managed.reconnectTimer = this.deps.clock.setTimeout(() => {
      void managed.adapter.connect().then(
        () => {
          managed.status = "running";
          managed.attempts = 0;
          this.writeAudit(name, "session:reconnected", "ok");
        },
        () => {
          this.scheduleReconnect(name);
        },
      );
    }, delay);
  }

  private writeAudit(name: string, action: string, result: "ok" | "error"): void {
    this.deps.audit.write({
      timestamp: new Date(this.deps.clock.now()).toISOString(),
      actor: "session-manager",
      action,
      target: name,
      result,
      correlationId: "session",
    });
  }
}

/** Creates a session manager. */
export function createSessionManager(deps: SessionManagerDeps): SessionManager {
  return new SessionManager(deps);
}

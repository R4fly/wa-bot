import { describe, expect, it } from "vitest";
import type { CapabilityFlags, EngineAdapter, EventHandler, NormalizedAuthEvent, NormalizedConnectionEvent } from "../adapters/contract.js";
import { createMemoryStorage } from "../infra/storage/memory.js";
import type { AuditEntry, AuditSink, Clock } from "../types/internal.js";
import { createAuthStateStore } from "./auth-state.js";
import { createBackoff } from "./backoff.js";
import { createSessionManager } from "./manager.js";

interface FakeAdapter extends EngineAdapter {
  emitConnection(status: "connected" | "disconnected" | "reconnecting"): void;
  emitAuthReady(): void;
  connectCalls: number;
}

function createFakeAdapter(): FakeAdapter {
  let handlers: EventHandler[] = [];
  let connected = false;
  const adapter: FakeAdapter = {
    name: "baileys",
    connectCalls: 0,
    capabilities: {
      supportsPairingCode: true,
      supportsEdit: true,
      supportsReaction: true,
      supportsDelete: true,
      supportsGroupAdmin: true,
      supportsPresence: true,
      supportsCallEvents: true,
      supportsMultiDevice: true,
    } as CapabilityFlags,
    async connect(): Promise<void> {
      adapter.connectCalls += 1;
      connected = true;
    },
    async disconnect(): Promise<void> {
      connected = false;
    },
    getConnectionStatus() {
      return connected ? "connected" : "disconnected";
    },
    async sendMessage(): Promise<string> {
      return "id";
    },
    async editMessage(): Promise<void> {
      return undefined;
    },
    async reactToMessage(): Promise<void> {
      return undefined;
    },
    async deleteMessage(): Promise<void> {
      return undefined;
    },
    async groupParticipants(): Promise<readonly string[]> {
      return [];
    },
    async groupSetSubject(): Promise<void> {
      return undefined;
    },
    async downloadMedia(): Promise<Uint8Array> {
      return new Uint8Array([1]);
    },
    async getProfileName(): Promise<string> {
      return "name";
    },
    onEvent(handler: EventHandler): () => void {
      handlers.push(handler);
      return () => {
        handlers = handlers.filter((item) => item !== handler);
      };
    },
    async getAuthState(): Promise<unknown> {
      return { saved: true };
    },
    async setAuthState(): Promise<void> {
      return undefined;
    },
    emitConnection(status: NormalizedConnectionEvent["status"]): void {
      const event: NormalizedConnectionEvent = { kind: "connection", sessionId: "s", status };
      for (const handler of [...handlers]) {
        handler(event);
      }
    },
    emitAuthReady(): void {
      const event: NormalizedAuthEvent = { kind: "auth", sessionId: "s", status: "ready" };
      for (const handler of [...handlers]) {
        handler(event);
      }
    },
  };
  return adapter;
}

function createDeps() {
  const entries: AuditEntry[] = [];
  const audit: AuditSink = {
    write(entry: AuditEntry): void {
      entries.push(entry);
    },
  };
  let time = 0;
  const timers: Array<{ fn: () => void; at: number }> = [];
  const clock: Clock = {
    now: () => time,
    setTimeout(fn: () => void, ms: number): unknown {
      timers.push({ fn, at: time + ms });
      return timers.length - 1;
    },
    clearTimeout(timer: unknown): void {
      const index = timer as number;
      if (timers[index] !== undefined) {
        timers[index] = { fn: () => undefined, at: -1 };
      }
    },
  };
  function runTimers(): void {
    const due = timers.filter((item) => item.at >= 0 && item.at <= time);
    for (const item of due) {
      item.at = -1;
      item.fn();
    }
  }
  const storage = createMemoryStorage();
  return { entries, audit, clock, storage, runTimers, advance: (ms: number) => { time += ms; } };
}

describe("SessionManager", () => {
  it("should persist auth state when the auth ready event arrives", async () => {
    const deps = createDeps();
    const manager = createSessionManager({
      clock: deps.clock,
      audit: deps.audit,
      authStoreFor: (name) => createAuthStateStore(deps.storage, name),
      backoff: createBackoff({ random: () => 0.5 }),
    });
    const adapter = createFakeAdapter();
    await manager.start("main", adapter);
    adapter.emitAuthReady();
    await Promise.resolve();
    await Promise.resolve();
    const saved = await deps.storage.get("session:main", "auth");
    expect(saved).toEqual({ saved: true });
  });

  it("should reconnect with backoff when the connection drops", async () => {
    const deps = createDeps();
    const manager = createSessionManager({
      clock: deps.clock,
      audit: deps.audit,
      authStoreFor: (name) => createAuthStateStore(deps.storage, name),
      backoff: createBackoff({ baseMs: 100, maxMs: 1000, random: () => 1 }),
    });
    const adapter = createFakeAdapter();
    await manager.start("main", adapter);
    adapter.emitConnection("disconnected");
    expect(manager.list()[0]?.status).toBe("reconnecting");
    deps.advance(100);
    deps.runTimers();
    await Promise.resolve();
    expect(adapter.connectCalls).toBe(2);
    expect(manager.list()[0]?.status).toBe("running");
  });

  it("should not reconnect when the session is stopped", async () => {
    const deps = createDeps();
    const manager = createSessionManager({
      clock: deps.clock,
      audit: deps.audit,
      authStoreFor: (name) => createAuthStateStore(deps.storage, name),
      backoff: createBackoff({ baseMs: 10, random: () => 1 }),
    });
    const adapter = createFakeAdapter();
    await manager.start("main", adapter);
    await manager.stop("main");
    adapter.emitConnection("disconnected");
    deps.advance(1000);
    deps.runTimers();
    await Promise.resolve();
    expect(adapter.connectCalls).toBe(1);
    expect(manager.list()).toEqual([]);
  });
});

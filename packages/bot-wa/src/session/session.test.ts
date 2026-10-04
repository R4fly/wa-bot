import { describe, expect, it } from "vitest";
import type { CapabilityFlags, EngineAdapter } from "../adapters/contract.js";
import { EngineCapabilityError } from "../kernel/errors/index.js";
import { createMemoryStorage } from "../infra/storage/memory.js";
import type { Clock } from "../types/internal.js";
import { backupSession, migrateSession, restoreSession } from "./backup.js";
import { createHealthMonitor } from "./health.js";
import { requestPairingCode } from "./pairing.js";

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
      for (const entry of timers) {
        if (!entry.dead && entry.at <= time) {
          entry.dead = true;
          entry.fn();
        }
      }
    },
  };
}

function adapterWithPairing(code: string | null): EngineAdapter {
  const capabilities: CapabilityFlags = {
    supportsPairingCode: code !== null,
    supportsEdit: true,
    supportsReaction: true,
    supportsDelete: true,
    supportsGroupAdmin: true,
    supportsPresence: true,
    supportsCallEvents: false,
    supportsMultiDevice: true,
  };
  return {
    name: "baileys",
    capabilities,
    connect: async () => undefined,
    disconnect: async () => undefined,
    getConnectionStatus: () => "disconnected",
    sendMessage: async () => "id",
    editMessage: async () => undefined,
    reactToMessage: async () => undefined,
    deleteMessage: async () => undefined,
    groupParticipants: async () => [],
    groupSetSubject: async () => undefined,
    downloadMedia: async () => new Uint8Array([1]),
    getProfileName: async () => "n",
    onEvent: () => () => undefined,
    getAuthState: async () => ({}),
    setAuthState: async () => undefined,
    ...(code === null
      ? {}
      : {
          requestPairingCode: async () => code,
        }),
  };
}

describe("requestPairingCode", () => {
  it("should return the code when the engine supports pairing", async () => {
    expect(await requestPairingCode(adapterWithPairing("ABCD1234"), "6281")).toBe("ABCD1234");
  });

  it("should throw EngineCapabilityError when the engine lacks pairing", async () => {
    await expect(requestPairingCode(adapterWithPairing(null), "6281")).rejects.toBeInstanceOf(
      EngineCapabilityError,
    );
  });
});

describe("createHealthMonitor", () => {
  it("should count consecutive failures and recover", async () => {
    const clock = manualClock();
    const failures: number[] = [];
    let ok = false;
    const monitor = createHealthMonitor({
      clock,
      intervalMs: 100,
      check: async () => ok,
      onUnhealthy: (count) => failures.push(count),
    });
    monitor.start();
    clock.advance(100);
    await Promise.resolve();
    clock.advance(100);
    await Promise.resolve();
    expect(failures).toEqual([1, 2]);
    expect(monitor.healthy).toBe(false);
    ok = true;
    clock.advance(100);
    await Promise.resolve();
    expect(monitor.healthy).toBe(true);
    monitor.stop();
  });
});

describe("backup and restore", () => {
  it("should round trip a session namespace", async () => {
    const source = createMemoryStorage();
    await source.set("session:main", "creds", { a: 1 });
    const snapshot = await backupSession(source, "main", "2026-01-01T00:00:00.000Z");
    const target = createMemoryStorage();
    await restoreSession(target, snapshot);
    expect(await target.get("session:main", "creds")).toEqual({ a: 1 });
  });

  it("should copy nothing when migrate runs as dry run", async () => {
    const from = createMemoryStorage();
    await from.set("session:main", "creds", { a: 1 });
    const to = createMemoryStorage();
    const result = await migrateSession(from, to, "main", true);
    expect(result).toEqual({ copied: 1, dryRun: true });
    expect(await to.get("session:main", "creds")).toBeUndefined();
  });
});

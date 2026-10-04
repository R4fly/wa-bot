import { describe, expect, it } from "vitest";
import { SandboxError } from "../../../kernel/errors/index.js";
import type { AuditEntry, AuditSink, Clock } from "../../../types/internal.js";
import { createEventBus, type SandboxViolationEvent } from "../../event/bus.js";
import { createMemoryChannelPair } from "./channel.js";
import { createSandboxHost } from "./host.js";
import { createSandboxPolicy } from "./policy.js";
import { SessionCipher } from "./protocol.js";
import type { PluginModule } from "./types.js";
import { runWorkerRuntime } from "./worker-runtime.js";

function createClock(): Clock & { advance: (ms: number) => void } {
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
      const entry = timer as { dead: boolean };
      entry.dead = true;
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

interface Harness {
  invoke: (handler: "activate" | "onMessage", payload: unknown) => Promise<void>;
  sent: string[];
  violations: SandboxViolationEvent[];
  entries: AuditEntry[];
  clock: Clock & { advance: (ms: number) => void };
  closeWorker: () => void;
}

function createHarness(
  plugin: PluginModule,
  permissions: Parameters<typeof createSandboxPolicy>[0],
): Harness {
  const pair = createMemoryChannelPair();
  const key = SessionCipher.generateKey();
  const clock = createClock();
  const sent: string[] = [];
  const entries: AuditEntry[] = [];
  const audit: AuditSink = {
    write(entry: AuditEntry): void {
      entries.push(entry);
    },
  };
  const bus = createEventBus();
  const violations: SandboxViolationEvent[] = [];
  bus.on("sandbox:violation", (event) => {
    violations.push(event);
  });
  const host = createSandboxHost({
    channel: pair.host,
    cipher: new SessionCipher(key),
    policy: createSandboxPolicy(permissions),
    handlers: {
      sendMessage: async (text) => {
        sent.push(text);
        return `id-${sent.length}`;
      },
    },
    timeoutMs: 100,
    clock,
    pluginName: "test-plugin",
    audit,
    bus,
  });
  void runWorkerRuntime({
    channel: pair.worker,
    cipher: new SessionCipher(key),
    loadModule: async () => plugin,
    entrySpecifier: "memory:plugin",
  });
  return {
    invoke: (handler, payload) => host.invokeHandler(handler, payload),
    sent,
    violations,
    entries,
    clock,
    closeWorker: () => pair.worker.close(),
  };
}

describe("sandbox host and worker runtime", () => {
  it("should deliver a plugin API call to the host when the permission is granted", async () => {
    const plugin: PluginModule = {
      onMessage: async (api) => {
        await api.sendMessage("pong");
      },
    };
    const harness = createHarness(plugin, ["send:message"]);
    await harness.invoke("onMessage", { messageId: "m1", body: "ping" });
    expect(harness.sent).toEqual(["pong"]);
    expect(harness.violations.length).toBe(0);
  });

  it("should deny an API call and record a violation when the permission is missing", async () => {
    let caught = "";
    const plugin: PluginModule = {
      onMessage: async (api) => {
        try {
          await api.sendMessage("pong");
        } catch (error) {
          caught = error instanceof Error ? error.message : "";
        }
      },
    };
    const harness = createHarness(plugin, []);
    await harness.invoke("onMessage", { messageId: "m1", body: "ping" });
    expect(harness.sent).toEqual([]);
    expect(caught).toContain("permission denied");
    expect(harness.violations.some((event) => event.reason.startsWith("permission-denied"))).toBe(true);
    expect(harness.entries.some((entry) => entry.action === "sandbox:violation")).toBe(true);
  });

  it("should reject the invocation with SandboxError when the handler exceeds the timeout", async () => {
    const plugin: PluginModule = {
      onMessage: () => new Promise<void>(() => undefined),
    };
    const harness = createHarness(plugin, []);
    const pending = harness.invoke("onMessage", {});
    harness.clock.advance(150);
    await expect(pending).rejects.toBeInstanceOf(SandboxError);
    expect(harness.violations.some((event) => event.reason === "handler-timeout")).toBe(true);
  });

  it("should reject pending invocations when the worker crashes", async () => {
    const plugin: PluginModule = {
      onMessage: () => new Promise<void>(() => undefined),
    };
    const harness = createHarness(plugin, []);
    const pending = harness.invoke("onMessage", {});
    harness.closeWorker();
    await expect(pending).rejects.toBeInstanceOf(SandboxError);
  });

  it("should report a handler error without stopping the host when the plugin throws", async () => {
    const plugin: PluginModule = {
      onMessage: async () => {
        throw new Error("boom");
      },
    };
    const harness = createHarness(plugin, []);
    await expect(harness.invoke("onMessage", {})).rejects.toBeInstanceOf(SandboxError);
  });
});

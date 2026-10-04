import { describe, expect, it } from "vitest";
import type { AuditEntry, AuditSink } from "../../../types/internal.js";
import { createEventBus, type SandboxViolationEvent } from "../../event/bus.js";
import { createMemoryChannelPair } from "./channel.js";
import { createSandboxHost } from "./host.js";
import { createSandboxPolicy } from "./policy.js";
import { encodeLine, SessionCipher } from "./protocol.js";
import type { PluginModule } from "./types.js";
import { runWorkerRuntime } from "./worker-runtime.js";

interface Harness {
  invoke: (payload: unknown) => Promise<void>;
  violations: SandboxViolationEvent[];
  entries: AuditEntry[];
  sendRawToWorker: (line: string) => void;
  sendCraftedToWorker: (plaintext: string) => void;
  sendCraftedToHost: (plaintext: string) => void;
  sendTamperedToHost: () => void;
}

function createHarness(
  plugin: PluginModule,
  permissions: Parameters<typeof createSandboxPolicy>[0],
  handlers: Parameters<typeof createSandboxHost>[0]["handlers"],
): Harness {
  const pair = createMemoryChannelPair();
  const key = SessionCipher.generateKey();
  const craft = new SessionCipher(key);
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
    handlers,
    timeoutMs: 500,
    clock: {
      now: () => 0,
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (timer) => clearTimeout(timer as NodeJS.Timeout),
    },
    pluginName: "api-plugin",
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
    invoke: (payload) => host.invokeHandler("onMessage", payload),
    violations,
    entries,
    sendRawToWorker: (line) => pair.host.send(line),
    sendCraftedToWorker: (plaintext) => pair.host.send(encodeLine(craft.encrypt(plaintext))),
    sendCraftedToHost: (plaintext) => pair.worker.send(encodeLine(craft.encrypt(plaintext))),
    sendTamperedToHost: () => {
      const frame = craft.encrypt("payload");
      pair.worker.send(encodeLine({ ...frame, tag: `${frame.tag.slice(0, -4)}AAAA` }));
    },
  };
}

describe("sandbox host api dispatch", () => {
  it("should deliver every permitted api call to its host handler", async () => {
    const results: string[] = [];
    const calls: string[] = [];
    const plugin: PluginModule = {
      onMessage: async (api) => {
        await api.storageSet("k", 1);
        const value = await api.storageGet("k");
        results.push(`get:${String(value)}`);
        const jobId = await api.schedulerAdd({ at: 1 });
        results.push(`sched:${jobId}`);
        await api.groupSetSubject("sub");
        results.push("subject:ok");
      },
    };
    const harness = createHarness(
      plugin,
      ["access:storage", "access:scheduler", "admin:group"],
      {
        storageGet: async (key) => {
          calls.push(`get:${key}`);
          return 7;
        },
        storageSet: async (key, value) => {
          calls.push(`set:${key}:${String(value)}`);
        },
        schedulerAdd: async () => {
          calls.push("sched");
          return "job-1";
        },
        groupSetSubject: async (subject) => {
          calls.push(`subject:${subject}`);
        },
      },
    );
    await harness.invoke({});
    expect(results).toEqual(["get:7", "sched:job-1", "subject:ok"]);
    expect(calls).toContain("set:k:1");
    expect(harness.violations.length).toBe(0);
  });

  it("should return a wired error when permission is granted but no handler exists", async () => {
    let caught = "";
    const plugin: PluginModule = {
      onMessage: async (api) => {
        try {
          await api.storageGet("k");
        } catch (error) {
          caught = error instanceof Error ? error.message : "";
        }
      },
    };
    const harness = createHarness(plugin, ["access:storage"], {});
    await harness.invoke({});
    expect(caught).toContain("api not wired");
  });

  it("should report bad-json when a decrypted worker line is not json", async () => {
    const harness = createHarness({ onMessage: async () => undefined }, [], {});
    harness.sendCraftedToWorker("not json");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.violations.some((event) => event.reason === "bad-json")).toBe(true);
  });

  it("should report unknown-frame when a decrypted worker line has an unknown kind", async () => {
    const harness = createHarness({ onMessage: async () => undefined }, [], {});
    harness.sendCraftedToWorker(JSON.stringify({ kind: "nope" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.violations.some((event) => event.reason === "unknown-frame")).toBe(true);
  });

  it("should ignore an api result whose call id is unknown", async () => {
    const harness = createHarness({ onMessage: async () => undefined }, [], {});
    harness.sendCraftedToWorker(JSON.stringify({ kind: "api-result", callId: "zz", ok: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.violations.length).toBe(0);
  });

  it("should report bad-frame when a host line cannot be decoded", async () => {
    const harness = createHarness({ onMessage: async () => undefined }, [], {});
    harness.sendRawToWorker("garbage");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.violations.some((event) => event.reason === "bad-frame")).toBe(true);
  });

  it("should report bad-frame when a worker line cannot be decoded", async () => {
    const harness = createHarness({ onMessage: async () => undefined }, [], {});
    harness.sendRawToWorker("garbage");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.entries.some((entry) => entry.action === "sandbox:violation")).toBe(true);
  });

  it("should report decrypt-failed when a worker frame tag is tampered", async () => {
    const harness = createHarness({ onMessage: async () => undefined }, [], {});
    harness.sendTamperedToHost();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.violations.some((event) => event.reason === "decrypt-failed")).toBe(true);
  });

  it("should report unknown-frame when a worker line kind is unknown", async () => {
    const harness = createHarness({ onMessage: async () => undefined }, [], {});
    harness.sendCraftedToHost(JSON.stringify({ kind: "nope" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(harness.violations.some((event) => event.reason === "unknown-frame")).toBe(true);
  });
});

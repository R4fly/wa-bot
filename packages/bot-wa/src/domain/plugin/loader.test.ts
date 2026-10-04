import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../../infra/storage/memory.js";
import { PluginError } from "../../kernel/errors/index.js";
import { sha256Hex } from "../../security/hash.js";
import { generateSigningKeypair, signPayload } from "../../security/sign.js";
import { createTrustStore } from "../../security/trust-store.js";
import type { AuditSink, Clock } from "../../types/internal.js";
import { createEventBus, type PluginLoadedEvent, type PluginRejectedEvent } from "../event/bus.js";
import { loadPlugin, type SandboxOpenOptions } from "./loader.js";
import { createPluginRegistry } from "./registry.js";
import { createMemoryChannelPair } from "./sandbox/channel.js";
import { createSandboxHost, type SandboxHost } from "./sandbox/host.js";
import { SessionCipher } from "./sandbox/protocol.js";
import type { PluginModule } from "./sandbox/types.js";
import { runWorkerRuntime } from "./sandbox/worker-runtime.js";

function createClock(): Clock {
  return {
    now: () => 0,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (timer) => clearTimeout(timer as NodeJS.Timeout),
  };
}

interface Fixture {
  manifest: Record<string, unknown>;
  bundle: Uint8Array;
  trustStore: ReturnType<typeof createTrustStore>;
  plugin: PluginModule;
}

async function createFixture(permissions: readonly string[]): Promise<Fixture> {
  const bundle = new Uint8Array([1, 2, 3]);
  const keypair = generateSigningKeypair();
  const hash = sha256Hex(bundle);
  const manifest: Record<string, unknown> = {
    name: "@scope/echo",
    version: "1.0.0",
    author: "ana",
    license: "MIT",
    engines: ">=0.6.0 <1.0.0",
    permissions: [...permissions],
    entry: "dist/index.js",
    hash,
    signature: signPayload(hash, keypair.privateKeyBase64),
    publisher: keypair.publicKeyBase64,
  };
  const trustStore = createTrustStore(createMemoryStorage());
  await trustStore.add(keypair.publicKeyBase64, "2026-01-01T00:00:00.000Z");
  const plugin: PluginModule = {
    onMessage: async (api) => {
      await api.sendMessage("pong");
    },
  };
  return { manifest, bundle, trustStore, plugin };
}

function createOpenSandbox(fixture: Fixture): (options: SandboxOpenOptions) => SandboxHost {
  return (options: SandboxOpenOptions): SandboxHost => {
    const pair = createMemoryChannelPair();
    const key = SessionCipher.generateKey();
    const host = createSandboxHost({
      channel: pair.host,
      cipher: new SessionCipher(key),
      policy: options.policy,
      handlers: { sendMessage: async () => "id-1" },
      timeoutMs: 500,
      clock: createClock(),
      pluginName: options.pluginName,
    });
    void runWorkerRuntime({
      channel: pair.worker,
      cipher: new SessionCipher(key),
      loadModule: async () => fixture.plugin,
      entrySpecifier: "memory:plugin",
    });
    return host;
  };
}

describe("loadPlugin", () => {
  it("should register the plugin and emit plugin:loaded when verification passes", async () => {
    const fixture = await createFixture(["send:message"]);
    const registry = createPluginRegistry();
    const bus = createEventBus();
    const loaded: PluginLoadedEvent[] = [];
    bus.on("plugin:loaded", (event) => loaded.push(event));
    const entries: Parameters<AuditSink["write"]>[0][] = [];
    const audit: AuditSink = {
      write: (entry) => entries.push(entry),
    };
    const manifest = await loadPlugin(
      {
        trustStore: fixture.trustStore,
        currentVersion: "0.6.0",
        registry,
        openSandbox: createOpenSandbox(fixture),
        bus,
        audit,
        clock: createClock(),
      },
      fixture.manifest,
      fixture.bundle,
      "memory:plugin",
    );
    expect(manifest.name).toBe("@scope/echo");
    expect(registry.list().length).toBe(1);
    expect(loaded.length).toBe(1);
  });

  it("should throw PluginError and emit plugin:rejected when the bundle is tampered", async () => {
    const fixture = await createFixture(["send:message"]);
    const registry = createPluginRegistry();
    const bus = createEventBus();
    const rejected: PluginRejectedEvent[] = [];
    bus.on("plugin:rejected", (event) => rejected.push(event));
    const audit: AuditSink = { write: () => undefined };
    await expect(
      loadPlugin(
        {
          trustStore: fixture.trustStore,
          currentVersion: "0.6.0",
          registry,
          openSandbox: createOpenSandbox(fixture),
          bus,
          audit,
          clock: createClock(),
        },
        fixture.manifest,
        new Uint8Array([9, 9]),
        "memory:plugin",
      ),
    ).rejects.toBeInstanceOf(PluginError);
    expect(registry.list().length).toBe(0);
    expect(rejected.length).toBe(1);
  });

  it("should throw PluginError when the same plugin is loaded twice", async () => {
    const fixture = await createFixture(["send:message"]);
    const registry = createPluginRegistry();
    const bus = createEventBus();
    const audit: AuditSink = { write: () => undefined };
    const deps = {
      trustStore: fixture.trustStore,
      currentVersion: "0.6.0",
      registry,
      openSandbox: createOpenSandbox(fixture),
      bus,
      audit,
      clock: createClock(),
    };
    await loadPlugin(deps, fixture.manifest, fixture.bundle, "memory:plugin");
    await expect(loadPlugin(deps, fixture.manifest, fixture.bundle, "memory:plugin")).rejects.toBeInstanceOf(
      PluginError,
    );
  });
});

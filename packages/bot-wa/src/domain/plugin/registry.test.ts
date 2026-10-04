import { describe, expect, it } from "vitest";
import { PluginError } from "../../kernel/errors/index.js";
import type { PluginManifest } from "./manifest.js";
import { createPluginRegistry } from "./registry.js";
import type { SandboxHost } from "./sandbox/host.js";

function manifest(name: string): PluginManifest {
  return {
    name,
    version: "1.0.0",
    author: "test",
    license: "MIT",
    engines: ">=0.6.0 <1.0.0",
    permissions: [],
    entry: "dist/index.js",
    hash: "hash",
    signature: "sig",
    publisher: "pub",
  };
}

function fakeHost(): SandboxHost {
  let closed = false;
  return {
    get closed(): boolean {
      return closed;
    },
    invokeHandler: async () => undefined,
    close(): void {
      closed = true;
    },
  } as unknown as SandboxHost;
}

describe("PluginRegistry", () => {
  it("should register and return a handle when get is called with its name", () => {
    const registry = createPluginRegistry();
    const handle = { manifest: manifest("@scope/echo"), host: fakeHost() };
    registry.set(handle);
    expect(registry.get("@scope/echo")).toBe(handle);
  });

  it("should throw PluginError when the same name is set twice", () => {
    const registry = createPluginRegistry();
    const handle = { manifest: manifest("@scope/echo"), host: fakeHost() };
    registry.set(handle);
    expect(() => registry.set(handle)).toThrow(PluginError);
  });

  it("should return undefined when get is called for an absent name", () => {
    const registry = createPluginRegistry();
    expect(registry.get("@scope/missing")).toBeUndefined();
  });

  it("should list manifests of every registered plugin", () => {
    const registry = createPluginRegistry();
    registry.set({ manifest: manifest("@scope/one"), host: fakeHost() });
    registry.set({ manifest: manifest("@scope/two"), host: fakeHost() });
    const list = registry.list();
    expect(list.length).toBe(2);
    expect(list.map((m) => m.name).sort()).toEqual(["@scope/one", "@scope/two"]);
  });

  it("should close the host and remove the handle when unload succeeds", async () => {
    const registry = createPluginRegistry();
    const host = fakeHost();
    registry.set({ manifest: manifest("@scope/echo"), host });
    const removed = await registry.unload("@scope/echo");
    expect(removed).toBe(true);
    expect(host.closed).toBe(true);
    expect(registry.get("@scope/echo")).toBeUndefined();
  });

  it("should return false and keep state when unload is called for an absent name", async () => {
    const registry = createPluginRegistry();
    const removed = await registry.unload("@scope/missing");
    expect(removed).toBe(false);
    expect(registry.list().length).toBe(0);
  });
});
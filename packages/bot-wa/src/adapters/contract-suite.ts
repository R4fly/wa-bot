import { describe, expect, it } from "vitest";
import type { EngineAdapter } from "./contract.js";

/**
 * Identical contract test suite that every adapter must pass.
 * Not part of the public API surface. Adapters invoke this from their own
 * test files starting v0.2.0.
 */
export function defineAdapterContractSuite(suiteName: string, factory: () => Promise<EngineAdapter>): void {
  describe(`adapter contract: ${suiteName}`, () => {
    it("should expose boolean capability flags when constructed", async () => {
      const adapter = await factory();
      const flags = Object.values(adapter.capabilities);
      expect(flags.length).toBe(8);
      for (const flag of flags) {
        expect(typeof flag).toBe("boolean");
      }
    });

    it("should report connected status after connect", async () => {
      const adapter = await factory();
      await adapter.connect();
      expect(adapter.getConnectionStatus()).toBe("connected");
      await adapter.disconnect();
    });

    it("should return a message id when sending a message", async () => {
      const adapter = await factory();
      await adapter.connect();
      const id = await adapter.sendMessage("target@example", "hello");
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      await adapter.disconnect();
    });

    it("should stop emitting events when unsubscribed", async () => {
      const adapter = await factory();
      let count = 0;
      const unsubscribe = adapter.onEvent(() => {
        count += 1;
      });
      unsubscribe();
      expect(count).toBe(0);
    });

    it("should return bytes when downloading media", async () => {
      const adapter = await factory();
      await adapter.connect();
      const bytes = await adapter.downloadMedia("media-1");
      expect(bytes.byteLength).toBeGreaterThan(0);
      await adapter.disconnect();
    });
  });
}

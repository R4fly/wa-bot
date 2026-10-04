import { describe, expect, it } from "vitest";
import { createEventBus, type PluginRejectedEvent } from "../event/bus.js";
import { createMemoryStorage } from "../../infra/storage/memory.js";
import { sha256Hex } from "../../security/hash.js";
import { generateSigningKeypair, signPayload } from "../../security/sign.js";
import { createTrustStore } from "../../security/trust-store.js";
import type { AuditEntry, AuditSink } from "../../types/internal.js";
import { verifyPlugin } from "./verifier.js";

const CURRENT_VERSION = "0.6.0";

interface Fixture {
  manifest: Record<string, unknown>;
  bundle: Uint8Array;
  trustStore: ReturnType<typeof createTrustStore>;
  keypair: ReturnType<typeof generateSigningKeypair>;
}

async function createFixture(): Promise<Fixture> {
  const bundle = new Uint8Array([1, 2, 3, 4]);
  const keypair = generateSigningKeypair();
  const hash = sha256Hex(bundle);
  const manifest: Record<string, unknown> = {
    name: "@scope/echo",
    version: "1.0.0",
    author: "ana",
    license: "MIT",
    engines: ">=0.6.0 <1.0.0",
    permissions: ["read:message"],
    entry: "dist/index.js",
    hash,
    signature: signPayload(hash, keypair.privateKeyBase64),
    publisher: keypair.publicKeyBase64,
  };
  const trustStore = createTrustStore(createMemoryStorage());
  await trustStore.add(keypair.publicKeyBase64, "2026-01-01T00:00:00.000Z");
  return { manifest, bundle, trustStore, keypair };
}

describe("verifyPlugin", () => {
  it("should accept a plugin when every check passes", async () => {
    const fixture = await createFixture();
    const result = await verifyPlugin(fixture.manifest, fixture.bundle, {
      trustStore: fixture.trustStore,
      currentVersion: CURRENT_VERSION,
    });
    expect(result.ok).toBe(true);
  });

  it("should report hash-mismatch when the bundle is modified", async () => {
    const fixture = await createFixture();
    const result = await verifyPlugin(fixture.manifest, new Uint8Array([9, 9]), {
      trustStore: fixture.trustStore,
      currentVersion: CURRENT_VERSION,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("hash-mismatch");
    }
  });

  it("should report signature-invalid when signed by another key", async () => {
    const fixture = await createFixture();
    const attacker = generateSigningKeypair();
    const manifest = {
      ...fixture.manifest,
      signature: signPayload(fixture.manifest["hash"] as string, attacker.privateKeyBase64),
    };
    const result = await verifyPlugin(manifest, fixture.bundle, {
      trustStore: fixture.trustStore,
      currentVersion: CURRENT_VERSION,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("signature-invalid");
    }
  });

  it("should report publisher-untrusted when the key is absent from the trust store", async () => {
    const fixture = await createFixture();
    const emptyStore = createTrustStore(createMemoryStorage());
    const result = await verifyPlugin(fixture.manifest, fixture.bundle, {
      trustStore: emptyStore,
      currentVersion: CURRENT_VERSION,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("publisher-untrusted");
    }
  });

  it("should report publisher-revoked when the key is revoked", async () => {
    const fixture = await createFixture();
    await fixture.trustStore.revoke(fixture.keypair.publicKeyBase64, "2026-02-01T00:00:00.000Z");
    const result = await verifyPlugin(fixture.manifest, fixture.bundle, {
      trustStore: fixture.trustStore,
      currentVersion: CURRENT_VERSION,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("publisher-revoked");
    }
  });

  it("should report engine-range-mismatch when the library version is outside the range", async () => {
    const fixture = await createFixture();
    const result = await verifyPlugin(fixture.manifest, fixture.bundle, {
      trustStore: fixture.trustStore,
      currentVersion: "2.0.0",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("engine-range-mismatch");
    }
  });

  it("should write an audit entry and emit plugin:rejected when a check fails", async () => {
    const fixture = await createFixture();
    const entries: AuditEntry[] = [];
    const audit: AuditSink = {
      write(entry: AuditEntry): void {
        entries.push(entry);
      },
    };
    const bus = createEventBus();
    const rejected: PluginRejectedEvent[] = [];
    bus.on("plugin:rejected", (event) => {
      rejected.push(event);
    });
    await verifyPlugin(fixture.manifest, new Uint8Array([9]), {
      trustStore: fixture.trustStore,
      currentVersion: CURRENT_VERSION,
      audit,
      bus,
      correlationId: "corr-1",
    });
    expect(entries.length).toBe(1);
    expect(entries[0]?.result).toBe("error");
    expect(rejected.length).toBe(1);
    expect(rejected[0]?.reason).toBe("hash-mismatch");
  });
});

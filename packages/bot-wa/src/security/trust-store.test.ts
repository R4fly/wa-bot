import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../infra/storage/memory.js";
import { createTrustStore } from "./trust-store.js";

describe("createTrustStore", () => {
  it("should report trusted when a key is added and not revoked", async () => {
    const store = createTrustStore(createMemoryStorage());
    await store.add("PUBKEY", "2026-01-01T00:00:00.000Z");
    expect(await store.isTrusted("PUBKEY")).toBe(true);
    expect(await store.isTrusted("OTHER")).toBe(false);
  });

  it("should report untrusted when a key is revoked", async () => {
    const store = createTrustStore(createMemoryStorage());
    await store.add("PUBKEY", "2026-01-01T00:00:00.000Z");
    expect(await store.revoke("PUBKEY", "2026-02-01T00:00:00.000Z")).toBe(true);
    expect(await store.isTrusted("PUBKEY")).toBe(false);
    expect(await store.isRevoked("PUBKEY")).toBe(true);
  });

  it("should remove a key when remove is called", async () => {
    const store = createTrustStore(createMemoryStorage());
    await store.add("PUBKEY", "2026-01-01T00:00:00.000Z");
    expect(await store.remove("PUBKEY")).toBe(true);
    expect(await store.has("PUBKEY")).toBe(false);
  });

  it("should list every entry when list is called", async () => {
    const store = createTrustStore(createMemoryStorage());
    await store.add("A", "2026-01-01T00:00:00.000Z");
    await store.add("B", "2026-01-02T00:00:00.000Z");
    const entries = await store.list();
    expect(entries.length).toBe(2);
  });
});

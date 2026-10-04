import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createSqliteStorage } from "./sqlite.js";

describe("createSqliteStorage", () => {
  it("should round trip a value when set then get", async () => {
    const dir = await mkdtemp(join(tmpdir(), "botwa-sqlite-"));
    const storage = createSqliteStorage({ path: join(dir, "test.db") });
    await storage.set("ns", "a", { x: 1 });
    expect(await storage.get("ns", "a")).toEqual({ x: 1 });
    await storage.disconnect();
  });

  it("should apply migrations idempotently when opened twice", async () => {
    const dir = await mkdtemp(join(tmpdir(), "botwa-sqlite-"));
    const path = join(dir, "test.db");
    const first = createSqliteStorage({ path });
    await first.set("ns", "a", 1);
    await first.disconnect();
    const second = createSqliteStorage({ path });
    expect(await second.get("ns", "a")).toBe(1);
    await second.disconnect();
  });

  it("should hide an expired entry when its ttl has passed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "botwa-sqlite-"));
    const storage = createSqliteStorage({ path: join(dir, "ttl.db") });
    await storage.set("ns", "a", 1, { ttlMs: 1 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(await storage.get("ns", "a")).toBeUndefined();
    await storage.disconnect();
  });
});

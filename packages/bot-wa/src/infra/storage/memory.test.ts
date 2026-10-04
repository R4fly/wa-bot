import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "./memory.js";

describe("createMemoryStorage", () => {
  it("should return the stored value when get is called after set", async () => {
    const storage = createMemoryStorage();
    await storage.set("ns", "a", { x: 1 });
    expect(await storage.get("ns", "a")).toEqual({ x: 1 });
  });

  it("should hide an entry when its ttl has passed", async () => {
    let time = 1000;
    const storage = createMemoryStorage(() => time);
    await storage.set("ns", "a", 1, { ttlMs: 100 });
    time = 1200;
    expect(await storage.get("ns", "a")).toBeUndefined();
    expect(await storage.has("ns", "a")).toBe(false);
  });

  it("should list only keys with the prefix when keys is called with prefix", async () => {
    const storage = createMemoryStorage();
    await storage.set("ns", "user:1", 1);
    await storage.set("ns", "user:2", 2);
    await storage.set("ns", "other", 3);
    expect(await storage.keys("ns", "user:")).toEqual(["user:1", "user:2"]);
  });
});

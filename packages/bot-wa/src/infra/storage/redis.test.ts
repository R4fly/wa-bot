import { describe, expect, it } from "vitest";
import { createRedisStorage } from "./redis.js";

const enabled = process.env.BOTWA_TEST_REDIS === "1";

describe.skipIf(!enabled)("createRedisStorage against a live server", () => {
  it("should round trip a value when set then get", async () => {
    const storage = createRedisStorage({ url: process.env.BOTWA_REDIS_URL ?? "redis://127.0.0.1:6379" });
    await storage.set("ns", "a", { x: 2 });
    expect(await storage.get("ns", "a")).toEqual({ x: 2 });
    await storage.clear("ns");
    await storage.disconnect();
  });
});

describe("redis adapter contract surface", () => {
  it("should expose the redis adapter name without connecting", () => {
    expect(typeof createRedisStorage).toBe("function");
  });
});

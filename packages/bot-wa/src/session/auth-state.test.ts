import { describe, expect, it } from "vitest";
import { createMemoryStorage } from "../infra/storage/memory.js";
import { createAuthStateStore } from "./auth-state.js";

describe("createAuthStateStore", () => {
  it("should isolate namespaces when two sessions save auth state", async () => {
    const storage = createMemoryStorage();
    const a = createAuthStateStore(storage, "a");
    const b = createAuthStateStore(storage, "b");
    await a.save({ id: "a" });
    await b.save({ id: "b" });
    expect(await a.load()).toEqual({ id: "a" });
    expect(await b.load()).toEqual({ id: "b" });
  });

  it("should remove the state when clear is called", async () => {
    const storage = createMemoryStorage();
    const store = createAuthStateStore(storage, "a");
    await store.save({ id: "a" });
    expect(await store.clear()).toBe(true);
    expect(await store.load()).toBeUndefined();
  });
});

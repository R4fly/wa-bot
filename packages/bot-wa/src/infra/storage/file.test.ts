import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileStorage } from "./file.js";

describe("createFileStorage", () => {
  it("should persist a value to disk when set is called", async () => {
    const dir = await mkdtemp(join(tmpdir(), "botwa-storage-"));
    const storage = createFileStorage(dir);
    await storage.set("sess", "auth", { token: "x" });
    const raw = await readFile(join(dir, "sess.json"), "utf8");
    expect(raw).toContain("auth");
    const reopened = createFileStorage(dir);
    expect(await reopened.get("sess", "auth")).toEqual({ token: "x" });
  });

  it("should remove the key when delete is called", async () => {
    const dir = await mkdtemp(join(tmpdir(), "botwa-storage-"));
    const storage = createFileStorage(dir);
    await storage.set("sess", "a", 1);
    expect(await storage.delete("sess", "a")).toBe(true);
    expect(await storage.get("sess", "a")).toBeUndefined();
  });

  it("should leave no temp files when persist completes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "botwa-storage-"));
    const storage = createFileStorage(dir);
    await storage.set("sess", "a", 1);
    const storage2 = createFileStorage(dir);
    expect(await storage2.keys("sess")).toEqual(["a"]);
  });
});

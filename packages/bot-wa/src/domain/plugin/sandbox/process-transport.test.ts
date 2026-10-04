import { describe, expect, it } from "vitest";
import { resolveWorkerEntryPath } from "./process-transport.js";

describe("resolveWorkerEntryPath", () => {
  it("should return a non-empty string when called", () => {
    const path = resolveWorkerEntryPath();
    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(0);
  });

  it("should contain worker-entry in the path", () => {
    const path = resolveWorkerEntryPath();
    expect(path).toContain("worker-entry");
  });
});

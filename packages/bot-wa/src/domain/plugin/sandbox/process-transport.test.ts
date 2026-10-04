import { describe, expect, it } from "vitest";
import { resolveWorkerEntryPath } from "./process-transport.js";

describe("resolveWorkerEntryPath", () => {
  it("should return a non-empty string when called", () => {
    const path = resolveWorkerEntryPath();
    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(0);
  });

  it("should point at worker-entry.js beside the built bundle", () => {
    const path = resolveWorkerEntryPath();
    expect(path.endsWith("worker-entry.js")).toBe(true);
  });
});

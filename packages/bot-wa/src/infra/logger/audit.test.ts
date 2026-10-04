import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../../types/internal.js";
import { createMemoryStorage } from "../storage/memory.js";
import { createAuditTrail } from "./audit.js";

function entry(timestamp: string, correlationId: string): AuditEntry {
  return {
    timestamp,
    actor: "test",
    action: "session:start",
    target: "default",
    result: "ok",
    correlationId,
  };
}

describe("createAuditTrail", () => {
  it("should return written entries when list is called", async () => {
    const trail = createAuditTrail({ storage: createMemoryStorage() });
    trail.write(entry("2026-01-01T00:00:00.000Z", "c1"));
    await trail.flush();
    const listed = await trail.list();
    expect(listed.length).toBe(1);
    expect(listed[0]?.correlationId).toBe("c1");
  });

  it("should remove entries older than retention when prune is called", async () => {
    const time = Date.parse("2026-02-15T00:00:00.000Z");
    const trail = createAuditTrail({
      storage: createMemoryStorage(),
      retentionDays: 30,
      now: () => time,
    });
    trail.write(entry("2026-01-01T00:00:00.000Z", "old"));
    trail.write(entry("2026-02-10T00:00:00.000Z", "new"));
    await trail.flush();
    const removed = await trail.prune();
    expect(removed).toBe(1);
    const listed = await trail.list();
    expect(listed.length).toBe(1);
    expect(listed[0]?.correlationId).toBe("new");
  });

  it("should respect the limit when list is called with limit", async () => {
    const trail = createAuditTrail({ storage: createMemoryStorage() });
    trail.write(entry("2026-01-01T00:00:00.000Z", "a"));
    trail.write(entry("2026-01-02T00:00:00.000Z", "b"));
    trail.write(entry("2026-01-03T00:00:00.000Z", "c"));
    await trail.flush();
    expect((await trail.list(2)).length).toBe(2);
  });
});

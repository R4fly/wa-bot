import { describe, expect, it } from "vitest";
import type { AuditEntry } from "../../types/internal.js";
import { createLogger, createMemorySink } from "./index.js";

function auditEntry(): AuditEntry {
  return {
    timestamp: "2025-01-01T00:00:00.000Z",
    actor: "test",
    action: "session:start",
    target: "default",
    result: "ok",
    correlationId: "corr-1",
  };
}

describe("createLogger", () => {
  it("should not write trace records when level is info", () => {
    const sink = createMemorySink();
    const logger = createLogger({ level: "info", format: "json", module: "test", sinks: [sink] });
    logger.trace("hidden");
    logger.info("visible");
    expect(sink.records.length).toBe(1);
    expect(sink.records[0]?.msg).toBe("visible");
  });

  it("should skip sampled levels when the injected random exceeds the sample rate", () => {
    const sink = createMemorySink();
    const logger = createLogger({
      level: "trace",
      format: "json",
      module: "test",
      sinks: [sink],
      sampleRate: 0.5,
      random: () => 0.9,
    });
    logger.debug("skipped");
    logger.info("kept");
    expect(sink.records.length).toBe(1);
    expect(sink.records[0]?.level).toBe("info");
  });

  it("should always write audit records regardless of level", () => {
    const sink = createMemorySink();
    const logger = createLogger({ level: "fatal", format: "json", module: "test", sinks: [sink] });
    logger.audit(auditEntry());
    expect(sink.records.length).toBe(1);
    expect(sink.records[0]?.level).toBe("audit");
  });

  it("should redact meta before any sink receives the record", () => {
    const sink = createMemorySink();
    const logger = createLogger({ level: "info", format: "json", module: "test", sinks: [sink] });
    logger.info("login", { token: "supersecret", user: "ana" });
    const record = sink.records[0] as Record<string, unknown>;
    expect(record["token"]).toBe("[REDACTED]");
    expect(record["user"]).toBe("ana");
  });
});

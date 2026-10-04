import { describe, expect, it } from "vitest";
import type { AuditEntry, AuditSink } from "../types/internal.js";
import { LifecycleError, TimeoutError } from "./errors/index.js";
import { createLifecycle, createSystemClock } from "./lifecycle.js";

function createAuditSink(): AuditSink & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    write(entry: AuditEntry): void {
      entries.push(entry);
    },
  };
}

function createLifecycleForTest(timeoutMs = 50) {
  const audit = createAuditSink();
  const lifecycle = createLifecycle({ clock: createSystemClock(), audit, defaultTimeoutMs: timeoutMs });
  return { audit, lifecycle };
}

describe("Lifecycle", () => {
  it("should commit idle to config_loading and write an audit entry", async () => {
    const { audit, lifecycle } = createLifecycleForTest();
    await lifecycle.runTransition("config_loading");
    expect(lifecycle.current).toBe("config_loading");
    expect(audit.entries.length).toBe(1);
    expect(audit.entries[0]?.action).toBe("transition:config_loading");
  });

  it("should throw LifecycleError when a backward transition is requested", async () => {
    const { lifecycle } = createLifecycleForTest();
    await lifecycle.runTransition("config_loading");
    await expect(lifecycle.runTransition("idle")).rejects.toBeInstanceOf(LifecycleError);
  });

  it("should enter failed and write an error audit entry when work throws", async () => {
    const { audit, lifecycle } = createLifecycleForTest();
    await lifecycle.runTransition("config_loading");
    await expect(
      lifecycle.runTransition("config_ready", async () => {
        throw new Error("boom");
      }),
    ).rejects.toBeInstanceOf(LifecycleError);
    expect(lifecycle.current).toBe("failed");
    expect(audit.entries.at(-1)?.result).toBe("error");
  });

  it("should return to idle when restart is called from failed", async () => {
    const { lifecycle } = createLifecycleForTest();
    await lifecycle.runTransition("config_loading");
    await lifecycle
      .runTransition("config_ready", async () => {
        throw new Error("boom");
      })
      .catch(() => undefined);
    lifecycle.restart();
    expect(lifecycle.current).toBe("idle");
  });

  it("should throw TimeoutError when work exceeds the transition timeout", async () => {
    const { lifecycle } = createLifecycleForTest(20);
    await lifecycle.runTransition("config_loading");
    await expect(
      lifecycle.runTransition("config_ready", () => new Promise<void>((resolve) => setTimeout(resolve, 200))),
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(lifecycle.current).toBe("failed");
  });
});

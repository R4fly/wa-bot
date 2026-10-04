import type { StorageAdapter } from "../storage/contract.js";
import type { AuditEntry, AuditSink } from "../../types/internal.js";

/** Options for the persistent audit trail. */
export interface AuditTrailOptions {
  readonly storage: StorageAdapter;
  readonly retentionDays?: number;
  readonly now?: () => number;
  readonly namespace?: string;
}

/** Audit sink with retention pruning and read access. */
export interface AuditTrail extends AuditSink {
  prune(): Promise<number>;
  list(limit?: number): Promise<readonly AuditEntry[]>;
  flush(): Promise<void>;
}

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_DAYS = 30;

function isAuditEntry(value: unknown): value is AuditEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["timestamp"] === "string" &&
    typeof record["actor"] === "string" &&
    typeof record["action"] === "string" &&
    typeof record["target"] === "string" &&
    typeof record["result"] === "string" &&
    typeof record["correlationId"] === "string"
  );
}

/**
 * Persistent audit trail over any storage adapter. Entries are keyed by
 * timestamp, sequence, and correlation id. Retention defaults to 30 days
 * and prune removes older entries. Write failures are captured and rethrown
 * by flush so graceful shutdown can fail loud.
 */
export function createAuditTrail(options: AuditTrailOptions): AuditTrail {
  const namespace = options.namespace ?? "audit";
  const now = options.now ?? (() => Date.now());
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  let sequence = 0;
  let pending: Array<Promise<void>> = [];

  return {
    write(entry: AuditEntry): void {
      sequence += 1;
      const key = `${entry.timestamp}_${String(sequence).padStart(8, "0")}_${entry.correlationId}`;
      const promise = options.storage.set(namespace, key, entry);
      promise.catch(() => undefined);
      pending.push(promise);
    },
    async flush(): Promise<void> {
      const batch = pending;
      pending = [];
      await Promise.all(batch);
    },
    async prune(): Promise<number> {
      const cutoff = now() - retentionDays * DAY_MS;
      const keys = await options.storage.keys(namespace);
      let removed = 0;
      for (const key of keys) {
        const raw = await options.storage.get(namespace, key);
        if (isAuditEntry(raw) && Date.parse(raw.timestamp) < cutoff) {
          await options.storage.delete(namespace, key);
          removed += 1;
        }
      }
      return removed;
    },
    async list(limit = 100): Promise<readonly AuditEntry[]> {
      const keys = await options.storage.keys(namespace);
      const entries: AuditEntry[] = [];
      for (const key of keys) {
        const raw = await options.storage.get(namespace, key);
        if (isAuditEntry(raw)) {
          entries.push(raw);
        }
      }
      entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return entries.slice(0, limit);
    },
  };
}

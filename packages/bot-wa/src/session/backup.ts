import type { StorageAdapter } from "../infra/storage/contract.js";

/** Serializable snapshot of one session namespace. */
export interface SessionSnapshot {
  readonly sessionName: string;
  readonly createdAt: string;
  readonly entries: Readonly<Record<string, unknown>>;
}

/** Result of a session migration between storage adapters. */
export interface MigrationResult {
  readonly copied: number;
  readonly dryRun: boolean;
}

function namespaceOf(sessionName: string): string {
  return `session:${sessionName}`;
}

/** Copies every key of one session namespace into a snapshot. */
export async function backupSession(
  storage: StorageAdapter,
  sessionName: string,
  createdAt: string,
): Promise<SessionSnapshot> {
  const namespace = namespaceOf(sessionName);
  const keys = await storage.keys(namespace);
  const entries: Record<string, unknown> = {};
  for (const key of keys) {
    entries[key] = await storage.get(namespace, key);
  }
  return { sessionName, createdAt, entries };
}

/** Writes a snapshot back into its session namespace, replacing content. */
export async function restoreSession(storage: StorageAdapter, snapshot: SessionSnapshot): Promise<void> {
  const namespace = namespaceOf(snapshot.sessionName);
  await storage.clear(namespace);
  for (const [key, value] of Object.entries(snapshot.entries)) {
    await storage.set(namespace, key, value);
  }
}

/** Copies one session namespace between adapters, optionally as a dry run. */
export async function migrateSession(
  from: StorageAdapter,
  to: StorageAdapter,
  sessionName: string,
  dryRun: boolean,
): Promise<MigrationResult> {
  const namespace = namespaceOf(sessionName);
  const keys = await from.keys(namespace);
  if (!dryRun) {
    for (const key of keys) {
      const value = await from.get(namespace, key);
      await to.set(namespace, key, value);
    }
  }
  return { copied: keys.length, dryRun };
}

import { createRequire } from "node:module";
import type { StorageAdapter, StorageSetOptions } from "./contract.js";

interface SqliteStatement {
  run(...args: unknown[]): { changes: number };
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
}

interface SqliteDb {
  prepare(sql: string): SqliteStatement;
  exec(sql: string): void;
  transaction(fn: () => void): () => void;
  close(): void;
}

type SqliteCtor = new (path: string) => SqliteDb;

interface KvRow {
  value: string;
  exp: number | null;
}

interface Migration {
  readonly version: number;
  readonly sql: string;
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: "CREATE TABLE IF NOT EXISTS kv (namespace TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, exp INTEGER, PRIMARY KEY (namespace, key))",
  },
];

function migrate(db: SqliteDb): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as { v: number | null };
  const current = row.v ?? 0;
  const pending = MIGRATIONS.filter((migration) => migration.version > current);
  if (pending.length === 0) {
    return;
  }
  const apply = db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.sql);
      db
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
    }
  });
  apply();
}

/**
 * SQLite storage adapter via better-sqlite3, loaded lazily through require so
 * the driver stays an optional peer. Schema migrations are versioned in
 * schema_migrations and applied inside one transaction.
 */
export function createSqliteStorage(options: { path: string }): StorageAdapter {
  const requireModule = createRequire(import.meta.url);
  const Ctor = requireModule("better-sqlite3") as unknown as SqliteCtor;
  const db = new Ctor(options.path);
  migrate(db);

  const select = db.prepare("SELECT value, exp FROM kv WHERE namespace = ? AND key = ?");
  const upsert = db.prepare(
    "INSERT INTO kv (namespace, key, value, exp) VALUES (?, ?, ?, ?) ON CONFLICT (namespace, key) DO UPDATE SET value = excluded.value, exp = excluded.exp",
  );
  const remove = db.prepare("DELETE FROM kv WHERE namespace = ? AND key = ?");
  const listKeys = db.prepare("SELECT key FROM kv WHERE namespace = ? AND (exp IS NULL OR exp > ?)");
  const clearNs = db.prepare("DELETE FROM kv WHERE namespace = ?");

  function read(namespace: string, key: string): unknown {
    const row = select.get(namespace, key) as KvRow | undefined;
    if (row === undefined) {
      return undefined;
    }
    if (row.exp !== null && row.exp <= Date.now()) {
      remove.run(namespace, key);
      return undefined;
    }
    return (JSON.parse(row.value) as { v: unknown }).v;
  }

  return {
    name: "sqlite",
    connect(): Promise<void> {
      return Promise.resolve();
    },
    async disconnect(): Promise<void> {
      db.close();
    },
    async get(namespace: string, key: string): Promise<unknown> {
      return read(namespace, key);
    },
    async set(namespace: string, key: string, value: unknown, setOptions?: StorageSetOptions): Promise<void> {
      const exp = setOptions?.ttlMs === undefined ? null : Date.now() + setOptions.ttlMs;
      upsert.run(namespace, key, JSON.stringify({ v: value }), exp);
    },
    async delete(namespace: string, key: string): Promise<boolean> {
      return remove.run(namespace, key).changes > 0;
    },
    async has(namespace: string, key: string): Promise<boolean> {
      return read(namespace, key) !== undefined;
    },
    async keys(namespace: string, prefix?: string): Promise<readonly string[]> {
      const rows = listKeys.all(namespace, Date.now()) as Array<{ key: string }>;
      return rows
        .map((row) => row.key)
        .filter((key) => prefix === undefined || key.startsWith(prefix));
    },
    async clear(namespace: string): Promise<void> {
      clearNs.run(namespace);
    },
  };
}

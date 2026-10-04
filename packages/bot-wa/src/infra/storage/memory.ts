import type { StorageAdapter, StorageSetOptions } from "./contract.js";

interface Entry {
  readonly value: unknown;
  readonly expiresAt: number | null;
}

/** In-memory storage for tests and development. Not persistent. */
export function createMemoryStorage(now: () => number = () => Date.now()): StorageAdapter {
  const namespaces = new Map<string, Map<string, Entry>>();

  function bucket(namespace: string): Map<string, Entry> {
    let existing = namespaces.get(namespace);
    if (existing === undefined) {
      existing = new Map<string, Entry>();
      namespaces.set(namespace, existing);
    }
    return existing;
  }

  function alive(entry: Entry): boolean {
    return entry.expiresAt === null || now() < entry.expiresAt;
  }

  return {
    name: "memory",
    connect(): Promise<void> {
      return Promise.resolve();
    },
    disconnect(): Promise<void> {
      return Promise.resolve();
    },
    async get(namespace: string, key: string): Promise<unknown> {
      const store = bucket(namespace);
      const entry = store.get(key);
      if (entry === undefined) {
        return undefined;
      }
      if (!alive(entry)) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    async set(namespace: string, key: string, value: unknown, options?: StorageSetOptions): Promise<void> {
      bucket(namespace).set(key, {
        value,
        expiresAt: options?.ttlMs === undefined ? null : now() + options.ttlMs,
      });
    },
    async delete(namespace: string, key: string): Promise<boolean> {
      return bucket(namespace).delete(key);
    },
    async has(namespace: string, key: string): Promise<boolean> {
      const store = bucket(namespace);
      const entry = store.get(key);
      if (entry === undefined) {
        return false;
      }
      if (!alive(entry)) {
        store.delete(key);
        return false;
      }
      return true;
    },
    async keys(namespace: string, prefix?: string): Promise<readonly string[]> {
      const store = bucket(namespace);
      const out: string[] = [];
      for (const [key, entry] of store.entries()) {
        if (alive(entry) && (prefix === undefined || key.startsWith(prefix))) {
          out.push(key);
        }
      }
      return out;
    },
    async clear(namespace: string): Promise<void> {
      bucket(namespace).clear();
    },
  };
}

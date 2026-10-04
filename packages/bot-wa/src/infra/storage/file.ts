import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StorageAdapter, StorageSetOptions } from "./contract.js";

interface FileEntry {
  readonly v: unknown;
  readonly exp: number | null;
}

type FileShape = Record<string, FileEntry>;

/**
 * File storage with one JSON document per namespace and atomic writes
 * via temp file plus rename. Single instance only, not multi process safe.
 */
export function createFileStorage(rootDir: string, now: () => number = () => Date.now()): StorageAdapter {
  const cache = new Map<string, FileShape>();

  function fileFor(namespace: string): string {
    const safe = namespace.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(rootDir, `${safe}.json`);
  }

  async function load(namespace: string): Promise<FileShape> {
    const cached = cache.get(namespace);
    if (cached !== undefined) {
      return cached;
    }
    let shape: FileShape = {};
    try {
      const raw = await readFile(fileFor(namespace), "utf8");
      shape = JSON.parse(raw) as FileShape;
    } catch {
      shape = {};
    }
    cache.set(namespace, shape);
    return shape;
  }

  async function persist(namespace: string): Promise<void> {
    const shape = cache.get(namespace) ?? {};
    await mkdir(rootDir, { recursive: true });
    const tmp = join(rootDir, `.tmp-${randomUUID()}.json`);
    await writeFile(tmp, JSON.stringify(shape), "utf8");
    await rename(tmp, fileFor(namespace));
  }

  function alive(entry: FileEntry): boolean {
    return entry.exp === null || now() < entry.exp;
  }

  return {
    name: "file",
    connect(): Promise<void> {
      return Promise.resolve();
    },
    disconnect(): Promise<void> {
      return Promise.resolve();
    },
    async get(namespace: string, key: string): Promise<unknown> {
      const shape = await load(namespace);
      const entry = shape[key];
      if (entry === undefined || !alive(entry)) {
        return undefined;
      }
      return entry.v;
    },
    async set(namespace: string, key: string, value: unknown, options?: StorageSetOptions): Promise<void> {
      const shape = await load(namespace);
      shape[key] = {
        v: value,
        exp: options?.ttlMs === undefined ? null : now() + options.ttlMs,
      };
      await persist(namespace);
    },
    async delete(namespace: string, key: string): Promise<boolean> {
      const shape = await load(namespace);
      if (shape[key] === undefined) {
        return false;
      }
      delete shape[key];
      await persist(namespace);
      return true;
    },
    async has(namespace: string, key: string): Promise<boolean> {
      const shape = await load(namespace);
      const entry = shape[key];
      return entry !== undefined && alive(entry);
    },
    async keys(namespace: string, prefix?: string): Promise<readonly string[]> {
      const shape = await load(namespace);
      return Object.entries(shape)
        .filter(([, entry]) => alive(entry))
        .map(([key]) => key)
        .filter((key) => prefix === undefined || key.startsWith(prefix));
    },
    async clear(namespace: string): Promise<void> {
      cache.set(namespace, {});
      await persist(namespace);
    },
  };
}

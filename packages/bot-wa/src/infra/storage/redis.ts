import { createRequire } from "node:module";
import type { StorageAdapter, StorageSetOptions } from "./contract.js";

interface RedisClient {
  hset(key: string, field: string, value: string): Promise<unknown>;
  hget(key: string, field: string): Promise<string | null>;
  hdel(key: string, field: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  del(key: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

type RedisCtor = new (url: string) => RedisClient;

interface Envelope {
  v: unknown;
  exp: number | null;
}

/**
 * Redis storage adapter via ioredis, loaded lazily through require so the
 * driver stays an optional peer. One hash per namespace. TTL is stored in the
 * value envelope and enforced lazily on read.
 */
export function createRedisStorage(options: { url: string }): StorageAdapter {
  const requireModule = createRequire(import.meta.url);
  const Ctor = requireModule("ioredis") as unknown as RedisCtor;
  const client = new Ctor(options.url);

  function nsKey(namespace: string): string {
    return `botwa:${namespace}`;
  }

  async function read(namespace: string, key: string): Promise<unknown> {
    const raw = await client.hget(nsKey(namespace), key);
    if (raw === null) {
      return undefined;
    }
    const envelope = JSON.parse(raw) as Envelope;
    if (envelope.exp !== null && envelope.exp <= Date.now()) {
      await client.hdel(nsKey(namespace), key);
      return undefined;
    }
    return envelope.v;
  }

  return {
    name: "redis",
    connect(): Promise<void> {
      return Promise.resolve();
    },
    async disconnect(): Promise<void> {
      await client.quit();
    },
    async get(namespace: string, key: string): Promise<unknown> {
      return read(namespace, key);
    },
    async set(namespace: string, key: string, value: unknown, setOptions?: StorageSetOptions): Promise<void> {
      const envelope: Envelope = {
        v: value,
        exp: setOptions?.ttlMs === undefined ? null : Date.now() + setOptions.ttlMs,
      };
      await client.hset(nsKey(namespace), key, JSON.stringify(envelope));
    },
    async delete(namespace: string, key: string): Promise<boolean> {
      return (await client.hdel(nsKey(namespace), key)) > 0;
    },
    async has(namespace: string, key: string): Promise<boolean> {
      return (await read(namespace, key)) !== undefined;
    },
    async keys(namespace: string, prefix?: string): Promise<readonly string[]> {
      const all = await client.hgetall(nsKey(namespace));
      const now = Date.now();
      const out: string[] = [];
      for (const [field, raw] of Object.entries(all)) {
        const envelope = JSON.parse(raw) as Envelope;
        if (envelope.exp !== null && envelope.exp <= now) {
          continue;
        }
        if (prefix === undefined || field.startsWith(prefix)) {
          out.push(field);
        }
      }
      return out;
    },
    async clear(namespace: string): Promise<void> {
      await client.del(nsKey(namespace));
    },
  };
}

import { ConfigError } from "../../kernel/errors/index.js";
import type { StorageName } from "../../kernel/config/schema.js";
import type { StorageAdapter } from "./contract.js";
import { createFileStorage } from "./file.js";
import { createMemoryStorage } from "./memory.js";
import { createRedisStorage } from "./redis.js";
import { createSqliteStorage } from "./sqlite.js";

/** Options for the storage factory. */
export interface StorageFactoryOptions {
  readonly storage: StorageName;
  readonly storagePath: string;
  readonly redisUrl?: string;
}

/**
 * Creates a storage adapter by configured name. SQLite and Redis drivers are
 * resolved lazily so missing optional peers fail with an actionable error.
 */
export function createStorageAdapter(options: StorageFactoryOptions): StorageAdapter {
  if (options.storage === "memory") {
    return createMemoryStorage();
  }
  if (options.storage === "file") {
    return createFileStorage(options.storagePath);
  }
  if (options.storage === "sqlite") {
    try {
      return createSqliteStorage({ path: options.storagePath });
    } catch (cause) {
      throw new ConfigError({
        message: "sqlite storage requires the optional peer better-sqlite3 to be installed",
        cause,
        context: { storage: "sqlite", peer: "better-sqlite3" },
      });
    }
  }
  if (options.storage === "redis") {
    if (options.redisUrl === undefined) {
      throw new ConfigError({
        message: "redis storage requires BOTWA_REDIS_URL to be set",
        context: { storage: "redis" },
      });
    }
    try {
      return createRedisStorage({ url: options.redisUrl });
    } catch (cause) {
      throw new ConfigError({
        message: "redis storage requires the optional peer ioredis to be installed",
        cause,
        context: { storage: "redis", peer: "ioredis" },
      });
    }
  }
  throw new ConfigError({
    message: `unknown storage ${String(options.storage)}`,
    context: { storage: String(options.storage) },
  });
}

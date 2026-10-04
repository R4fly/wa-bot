import { readFile } from "node:fs/promises";
import { ENV_PREFIX } from "@baehaqirafly3/bot-wa-shared";
import { ConfigError } from "../errors/index.js";
import { DEFAULT_CONFIG, validateConfig, type BotConfig } from "./schema.js";

/** Flat config keys accepted from env (with BOTWA_ prefix) and from CLI args (without prefix). */
export const FLAT_KEYS = [
  "ENGINE_NAME",
  "SESSION_NAME",
  "SESSION_STORAGE",
  "SESSION_STORAGE_PATH",
  "LOGGER_LEVEL",
  "LOGGER_FORMAT",
  "LOGGER_SAMPLE_RATE",
  "PLUGIN_TRUST_STORE",
  "PLUGIN_TIMEOUT_MS",
  "PLUGIN_MEMORY_MB",
  "QUEUE_DRIVER",
  "QUEUE_CONCURRENCY",
  "QUEUE_MAX_LEN",
  "REDIS_URL",
] as const;

/** One flat key. */
export type FlatKey = (typeof FLAT_KEYS)[number];

const KEY_TO_PATH: Record<FlatKey, string> = {
  ENGINE_NAME: "engine.name",
  SESSION_NAME: "session.name",
  SESSION_STORAGE: "session.storage",
  SESSION_STORAGE_PATH: "session.storagePath",
  LOGGER_LEVEL: "logger.level",
  LOGGER_FORMAT: "logger.format",
  LOGGER_SAMPLE_RATE: "logger.sampleRate",
  PLUGIN_TRUST_STORE: "plugin.trustStorePath",
  PLUGIN_TIMEOUT_MS: "plugin.timeoutMs",
  PLUGIN_MEMORY_MB: "plugin.memoryMb",
  QUEUE_DRIVER: "queue.driver",
  QUEUE_CONCURRENCY: "queue.concurrency",
  QUEUE_MAX_LEN: "queue.maxLen",
  REDIS_URL: "redisUrl",
};

/** Sources for config loading, in increasing precedence: defaults, file, env, cli. */
export interface ConfigSources {
  readonly cli?: Readonly<Partial<Record<FlatKey, string>>>;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly filePath?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const current = out[key];
    if (isRecord(current) && isRecord(value)) {
      out[key] = deepMerge(current, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i] as string;
    const next = cursor[key];
    if (!isRecord(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1] as string] = value;
}

function parseFlatValue(key: FlatKey, raw: string): unknown {
  if (key === "PLUGIN_TIMEOUT_MS" || key === "PLUGIN_MEMORY_MB" || key === "QUEUE_CONCURRENCY" || key === "QUEUE_MAX_LEN") {
    return Number(raw);
  }
  if (key === "LOGGER_SAMPLE_RATE") {
    return Number(raw);
  }
  return raw;
}

/**
 * Loads and validates configuration.
 * Precedence: CLI args, then BOTWA_ env, then config file, then defaults.
 * Throws ConfigError with actionable issues before the bot can half-start.
 */
export async function loadConfig(sources: ConfigSources = {}): Promise<BotConfig> {
  let merged: Record<string, unknown> = deepMerge({}, DEFAULT_CONFIG as unknown as Record<string, unknown>);

  if (sources.filePath !== undefined) {
    let raw: string;
    try {
      raw = await readFile(sources.filePath, "utf8");
    } catch (cause) {
      throw new ConfigError({
        message: `config file unreadable at ${sources.filePath}`,
        cause,
        context: { field: "filePath", received: sources.filePath, expected: "readable json file" },
      });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (cause) {
      throw new ConfigError({
        message: `config file at ${sources.filePath} is not valid json`,
        cause,
      });
    }
    if (!isRecord(parsed)) {
      throw new ConfigError({
        message: `config file at ${sources.filePath} must contain a json object`,
        context: { field: "(root)", received: typeof parsed, expected: "object" },
      });
    }
    merged = deepMerge(merged, parsed);
  }

  const env = sources.env ?? {};
  for (const key of FLAT_KEYS) {
    const raw = env[`${ENV_PREFIX}${key}`];
    if (raw !== undefined) {
      setPath(merged, KEY_TO_PATH[key], parseFlatValue(key, raw));
    }
  }

  const cli = sources.cli ?? {};
  for (const key of FLAT_KEYS) {
    const raw = cli[key];
    if (raw !== undefined) {
      setPath(merged, KEY_TO_PATH[key], parseFlatValue(key, raw));
    }
  }

  const result = validateConfig(merged);
  if (!result.ok) {
    const detail = result.issues
      .map((issue) => `${issue.field}: received ${JSON.stringify(issue.received)}, expected ${issue.expected}`)
      .join("; ");
    throw new ConfigError({
      message: `invalid configuration. ${detail}`,
      context: { issues: result.issues },
    });
  }
  return result.value;
}

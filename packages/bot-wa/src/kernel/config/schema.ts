import {
  DEFAULT_PLUGIN_MEMORY_MB,
  DEFAULT_PLUGIN_TIMEOUT_MS,
  DEFAULT_SAMPLE_RATE,
} from "@baehaqirafly3/bot-wa-shared";

/** Supported engine names. */
export type EngineName = "baileys" | "wwebjs";

/** Supported session storage backends. */
export type StorageName = "memory" | "file" | "sqlite" | "redis";

/** Logger levels, excluding the separate audit channel. */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/** Logger output format. */
export type LogFormat = "json" | "pretty";

/** Queue drivers. */
export type QueueDriver = "memory" | "bullmq";

/** Engine selection config. */
export interface EngineConfig {
  readonly name: EngineName;
}

/** Session config. */
export interface SessionConfig {
  readonly name: string;
  readonly storage: StorageName;
  readonly storagePath: string;
}

/** Logger config. */
export interface LoggerConfig {
  readonly level: LogLevel;
  readonly format: LogFormat;
  readonly sampleRate: number;
}

/** Plugin subsystem config. */
export interface PluginConfig {
  readonly trustStorePath: string;
  readonly timeoutMs: number;
  readonly memoryMb: number;
}

/** Queue config. */
export interface QueueConfig {
  readonly driver: QueueDriver;
  readonly concurrency: number;
  readonly maxLen: number;
}

/** Full validated bot configuration. */
export interface BotConfig {
  readonly engine: EngineConfig;
  readonly session: SessionConfig;
  readonly logger: LoggerConfig;
  readonly plugin: PluginConfig;
  readonly queue: QueueConfig;
  readonly redisUrl?: string;
}

/** One actionable validation problem: field, received value, expected shape. */
export interface ConfigIssue {
  readonly field: string;
  readonly received: unknown;
  readonly expected: string;
}

/** Result of schema validation. */
export type ConfigValidation =
  | { readonly ok: true; readonly value: BotConfig }
  | { readonly ok: false; readonly issues: readonly ConfigIssue[] };

/** Default configuration used when no source overrides a field. */
export const DEFAULT_CONFIG: BotConfig = {
  engine: { name: "baileys" },
  session: { name: "default", storage: "file", storagePath: "./sessions" },
  logger: { level: "info", format: "pretty", sampleRate: DEFAULT_SAMPLE_RATE },
  plugin: {
    trustStorePath: "./trust-store.json",
    timeoutMs: DEFAULT_PLUGIN_TIMEOUT_MS,
    memoryMb: DEFAULT_PLUGIN_MEMORY_MB,
  },
  queue: { driver: "memory", concurrency: 5, maxLen: 1000 },
};

const ENGINE_NAMES: readonly string[] = ["baileys", "wwebjs"];
const STORAGE_NAMES: readonly string[] = ["memory", "file", "sqlite", "redis"];
const LOG_LEVELS: readonly string[] = ["trace", "debug", "info", "warn", "error", "fatal"];
const LOG_FORMATS: readonly string[] = ["json", "pretty"];
const QUEUE_DRIVERS: readonly string[] = ["memory", "bullmq"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkEnum(
  issues: ConfigIssue[],
  field: string,
  value: unknown,
  allowed: readonly string[],
): string | undefined {
  if (typeof value !== "string" || !allowed.includes(value)) {
    issues.push({ field, received: value, expected: `one of ${allowed.join(", ")}` });
    return undefined;
  }
  return value;
}

function checkString(issues: ConfigIssue[], field: string, value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    issues.push({ field, received: value, expected: "non-empty string" });
    return undefined;
  }
  return value;
}

function checkInt(
  issues: ConfigIssue[],
  field: string,
  value: unknown,
  min: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min) {
    issues.push({ field, received: value, expected: `integer >= ${min}` });
    return undefined;
  }
  return value;
}

function checkRate(issues: ConfigIssue[], field: string, value: unknown): number | undefined {
  if (typeof value !== "number" || value < 0 || value > 1) {
    issues.push({ field, received: value, expected: "number between 0 and 1" });
    return undefined;
  }
  return value;
}

/** Validates an unknown object against the single config schema. */
export function validateConfig(input: unknown): ConfigValidation {
  const issues: ConfigIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [{ field: "(root)", received: input, expected: "object" }] };
  }

  const engine = isRecord(input["engine"]) ? input["engine"] : {};
  const session = isRecord(input["session"]) ? input["session"] : {};
  const logger = isRecord(input["logger"]) ? input["logger"] : {};
  const plugin = isRecord(input["plugin"]) ? input["plugin"] : {};
  const queue = isRecord(input["queue"]) ? input["queue"] : {};

  const engineName = checkEnum(issues, "engine.name", engine["name"] ?? DEFAULT_CONFIG.engine.name, ENGINE_NAMES);
  const sessionName = checkString(issues, "session.name", session["name"] ?? DEFAULT_CONFIG.session.name);
  const storage = checkEnum(issues, "session.storage", session["storage"] ?? DEFAULT_CONFIG.session.storage, STORAGE_NAMES);
  const storagePath = checkString(issues, "session.storagePath", session["storagePath"] ?? DEFAULT_CONFIG.session.storagePath);
  const level = checkEnum(issues, "logger.level", logger["level"] ?? DEFAULT_CONFIG.logger.level, LOG_LEVELS);
  const format = checkEnum(issues, "logger.format", logger["format"] ?? DEFAULT_CONFIG.logger.format, LOG_FORMATS);
  const sampleRate = checkRate(issues, "logger.sampleRate", logger["sampleRate"] ?? DEFAULT_CONFIG.logger.sampleRate);
  const trustStorePath = checkString(issues, "plugin.trustStorePath", plugin["trustStorePath"] ?? DEFAULT_CONFIG.plugin.trustStorePath);
  const timeoutMs = checkInt(issues, "plugin.timeoutMs", plugin["timeoutMs"] ?? DEFAULT_CONFIG.plugin.timeoutMs, 1);
  const memoryMb = checkInt(issues, "plugin.memoryMb", plugin["memoryMb"] ?? DEFAULT_CONFIG.plugin.memoryMb, 1);
  const driver = checkEnum(issues, "queue.driver", queue["driver"] ?? DEFAULT_CONFIG.queue.driver, QUEUE_DRIVERS);
  const concurrency = checkInt(issues, "queue.concurrency", queue["concurrency"] ?? DEFAULT_CONFIG.queue.concurrency, 1);
  const maxLen = checkInt(issues, "queue.maxLen", queue["maxLen"] ?? DEFAULT_CONFIG.queue.maxLen, 1);

  let redisUrl: string | undefined;
  if (input["redisUrl"] !== undefined) {
    redisUrl = checkString(issues, "redisUrl", input["redisUrl"]);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const value: BotConfig = {
    engine: { name: engineName as EngineName },
    session: {
      name: sessionName as string,
      storage: storage as StorageName,
      storagePath: storagePath as string,
    },
    logger: {
      level: level as LogLevel,
      format: format as LogFormat,
      sampleRate: sampleRate as number,
    },
    plugin: {
      trustStorePath: trustStorePath as string,
      timeoutMs: timeoutMs as number,
      memoryMb: memoryMb as number,
    },
    queue: {
      driver: driver as QueueDriver,
      concurrency: concurrency as number,
      maxLen: maxLen as number,
    },
    ...(redisUrl === undefined ? {} : { redisUrl }),
  };
  return { ok: true, value };
}

import { randomInt } from "node:crypto";
import { DEFAULT_SAMPLE_RATE } from "@baehaqirafly3/bot-wa-shared";
import type { AuditEntry } from "../../types/internal.js";
import { redact } from "./redactor.js";

/** Logger levels excluding the separate audit channel. */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/** One structured log record, already redacted. */
export interface LogRecord {
  readonly time: string;
  readonly level: LogLevel | "audit";
  readonly module: string;
  readonly correlationId: string;
  readonly msg: string;
  readonly [key: string]: unknown;
}

/** Sink that receives redacted records. */
export interface LogSink {
  write(record: LogRecord): void;
}

/** Options for logger creation. All randomness and time are injectable. */
export interface LoggerOptions {
  readonly level: LogLevel;
  readonly format: "json" | "pretty";
  readonly module: string;
  readonly correlationId?: string;
  readonly sinks?: readonly LogSink[];
  readonly sampleRate?: number;
  readonly random?: () => number;
  readonly now?: () => number;
}

/** Logger surface: six levels plus audit, plus child loggers. */
export interface Logger {
  trace(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  fatal(msg: string, meta?: Record<string, unknown>): void;
  audit(entry: AuditEntry): void;
  child(overrides: { readonly module?: string; readonly correlationId?: string }): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const SAMPLED_LEVELS: readonly LogLevel[] = ["trace", "debug"];

/** Console sink writing one line per record to stdout. */
export function createConsoleSink(): LogSink {
  return {
    write(record: LogRecord): void {
      process.stdout.write(`${JSON.stringify(record)}\n`);
    },
  };
}

/** In-memory sink for tests and inspection. */
export function createMemorySink(): LogSink & { readonly records: LogRecord[] } {
  const records: LogRecord[] = [];
  return {
    records,
    write(record: LogRecord): void {
      records.push(record);
    },
  };
}

/** Creates a logger. Redaction runs before every sink. trace and debug are sampled by default. */
export function createLogger(options: LoggerOptions): Logger {
  const sinks = options.sinks ?? [createConsoleSink()];
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const random = options.random ?? (() => randomInt(0, 100_000) / 100_000);
  const now = options.now ?? (() => Date.now());
  const baseCorrelationId = options.correlationId ?? "none";

  function emit(level: LogLevel | "audit", msg: string, meta: Record<string, unknown>, correlationId: string): void {
    const record: LogRecord = {
      time: new Date(now()).toISOString(),
      level,
      module: options.module,
      correlationId,
      msg,
      ...(redact(meta) as Record<string, unknown>),
    };
    for (const sink of sinks) {
      if (options.format === "pretty" && level !== "audit") {
        sink.write({ ...record, msg: `${level.toUpperCase()} [${options.module}] ${msg}` });
      } else {
        sink.write(record);
      }
    }
  }

  function log(level: LogLevel, msg: string, meta: Record<string, unknown>, correlationId: string): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[options.level]) {
      return;
    }
    if (SAMPLED_LEVELS.includes(level) && random() > sampleRate) {
      return;
    }
    emit(level, msg, meta, correlationId);
  }

  const logger: Logger = {
    trace(msg, meta = {}) {
      log("trace", msg, meta, baseCorrelationId);
    },
    debug(msg, meta = {}) {
      log("debug", msg, meta, baseCorrelationId);
    },
    info(msg, meta = {}) {
      log("info", msg, meta, baseCorrelationId);
    },
    warn(msg, meta = {}) {
      log("warn", msg, meta, baseCorrelationId);
    },
    error(msg, meta = {}) {
      log("error", msg, meta, baseCorrelationId);
    },
    fatal(msg, meta = {}) {
      log("fatal", msg, meta, baseCorrelationId);
    },
    audit(entry: AuditEntry): void {
      emit("audit", entry.action, { ...entry }, entry.correlationId);
    },
    child(overrides) {
      const cid = overrides.correlationId ?? options.correlationId;
      return createLogger({
        level: options.level,
        format: options.format,
        module: overrides.module ?? options.module,
        sinks,
        sampleRate,
        random,
        now,
        ...(cid !== undefined ? { correlationId: cid } : {}),
      });
    },
  };
  return logger;
}

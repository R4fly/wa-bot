/** Prefix for every environment variable read by the library. */
export const ENV_PREFIX = "BOTWA_";

/** Default timeout for one lifecycle transition, in milliseconds. */
export const DEFAULT_TRANSITION_TIMEOUT_MS = 30_000;

/** Default plugin handler timeout, in milliseconds. */
export const DEFAULT_PLUGIN_TIMEOUT_MS = 2_000;

/** Default plugin memory limit, in megabytes. */
export const DEFAULT_PLUGIN_MEMORY_MB = 64;

/** Default audit log retention, in days. */
export const AUDIT_RETENTION_DAYS = 30;

/** Default application log retention, in days. */
export const APP_LOG_RETENTION_DAYS = 7;

/** Default trace and debug sampling rate. */
export const DEFAULT_SAMPLE_RATE = 0.1;

/** CLI exit codes: 0 ok, 1 general error, 2 bad arguments, 3 bad config, 4 runtime failure. */
export const EXIT_CODES = {
  OK: 0,
  GENERAL: 1,
  BAD_ARGS: 2,
  BAD_CONFIG: 3,
  RUNTIME: 4,
} as const;

/** Exit code value type. */
export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

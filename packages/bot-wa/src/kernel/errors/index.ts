import { randomUUID } from "node:crypto";

/** Stable machine-readable error codes. */
export const ErrorCodes = {
  CONFIG: "E_CONFIG",
  LIFECYCLE: "E_LIFECYCLE",
  ENGINE: "E_ENGINE",
  CAPABILITY: "E_CAPABILITY",
  PLUGIN: "E_PLUGIN",
  SANDBOX: "E_SANDBOX",
  SESSION: "E_SESSION",
  STORAGE: "E_STORAGE",
  NETWORK: "E_NETWORK",
  TIMEOUT: "E_TIMEOUT",
  RATE_LIMIT: "E_RATE_LIMIT",
} as const;

/** Union of all error codes. */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** Free-form, already redacted, structured error context. */
export interface ErrorContext {
  readonly [key: string]: unknown;
}

/** Initialization options for every typed error. */
export interface BaseErrorInit {
  readonly message: string;
  readonly retryable?: boolean;
  readonly context?: ErrorContext;
  readonly cause?: unknown;
  readonly correlationId?: string;
}

/** Base class for the whole error taxonomy. */
export class BaseError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly context: ErrorContext;
  readonly correlationId: string;

  constructor(code: ErrorCode, init: BaseErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });
    this.name = new.target.name;
    this.code = code;
    this.retryable = init.retryable ?? false;
    this.context = init.context ?? {};
    this.correlationId = init.correlationId ?? randomUUID();
  }
}

/** Invalid or missing configuration. */
export class ConfigError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.CONFIG, init);
  }
}

/** Illegal lifecycle transition or lifecycle work failure. */
export class LifecycleError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.LIFECYCLE, init);
  }
}

/** Any failure originating from an engine adapter. */
export class EngineError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.ENGINE, init);
  }
}

/** Feature requested but not supported by the selected engine. */
export class EngineCapabilityError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.CAPABILITY, init);
  }
}

/** Plugin manifest, verification, or load failure. */
export class PluginError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.PLUGIN, init);
  }
}

/** Sandbox policy violation or sandbox resource failure. */
export class SandboxError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.SANDBOX, init);
  }
}

/** Session lifecycle or auth state failure. */
export class SessionError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.SESSION, init);
  }
}

/** Storage adapter failure. Retryable for transient backends. */
export class StorageError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.STORAGE, { retryable: true, ...init });
  }
}

/** Network failure. Retryable by default. */
export class NetworkError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.NETWORK, { retryable: true, ...init });
  }
}

/** Operation exceeded its deadline. */
export class TimeoutError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.TIMEOUT, { retryable: true, ...init });
  }
}

/** Rate limit or bounded queue rejection. */
export class RateLimitError extends BaseError {
  constructor(init: BaseErrorInit) {
    super(ErrorCodes.RATE_LIMIT, { retryable: true, ...init });
  }
}

/** Wraps an unknown adapter failure into EngineError with cause preserved. */
export function wrapEngineError(cause: unknown, message: string, correlationId?: string): EngineError {
  return new EngineError({
    message,
    cause,
    context: { wrapped: cause instanceof Error ? cause.name : typeof cause },
    ...(correlationId !== undefined ? { correlationId } : {}),
  });
}
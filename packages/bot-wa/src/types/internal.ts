/** Injectable clock so tests control time deterministically. */
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(timer: unknown): void;
}

/** One entry in the audit trail. Metadata must already be redacted by the caller. */
export interface AuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly action: string;
  readonly target: string;
  readonly result: "ok" | "error";
  readonly correlationId: string;
  readonly metadata?: Record<string, unknown>;
}

/** Sink that receives audit entries. Implementations decide storage and retention. */
export interface AuditSink {
  write(entry: AuditEntry): void;
}

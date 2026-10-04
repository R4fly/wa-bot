/** One trace span. Compatible with OpenTelemetry adapters. */
export interface Span {
  readonly name: string;
  readonly startedAt: number;
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
}

/** Sink for trace hooks. No vendor lock: adapters implement this. */
export interface TraceSink {
  startSpan(name: string, attributes?: Readonly<Record<string, string | number | boolean>>): Span;
  endSpan(span: Span, status: "ok" | "error"): void;
}

/** Trace sink that discards everything. The default. */
export function createNoopTracer(): TraceSink {
  return {
    startSpan(name: string, attributes: Readonly<Record<string, string | number | boolean>> = {}): Span {
      return { name, startedAt: 0, attributes };
    },
    endSpan(): void {
      return undefined;
    },
  };
}

/** Recorded finished span for tests and adapters. */
export interface FinishedSpan extends Span {
  readonly status: "ok" | "error";
}

/** In-memory trace sink for tests. */
export function createMemoryTracer(): TraceSink & { finished: readonly FinishedSpan[] } {
  const finished: FinishedSpan[] = [];
  let counter = 0;
  return {
    finished,
    startSpan(name: string, attributes: Readonly<Record<string, string | number | boolean>> = {}): Span {
      counter += 1;
      return { name, startedAt: counter, attributes };
    },
    endSpan(span: Span, status: "ok" | "error"): void {
      finished.push({ ...span, status });
    },
  };
}

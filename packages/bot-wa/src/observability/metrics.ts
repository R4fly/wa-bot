/** Sink for metrics hooks. No vendor lock: adapters implement this. */
export interface MetricsSink {
  counter(name: string, value: number, labels?: Readonly<Record<string, string>>): void;
  gauge(name: string, value: number, labels?: Readonly<Record<string, string>>): void;
  histogram(name: string, value: number, labels?: Readonly<Record<string, string>>): void;
}

/** Metrics sink that discards everything. The default. */
export function createNoopMetrics(): MetricsSink {
  return {
    counter(): void {
      return undefined;
    },
    gauge(): void {
      return undefined;
    },
    histogram(): void {
      return undefined;
    },
  };
}

/** Recorded metric point for tests and adapters. */
export interface MetricPoint {
  readonly kind: "counter" | "gauge" | "histogram";
  readonly name: string;
  readonly value: number;
  readonly labels: Readonly<Record<string, string>>;
}

/** In-memory metrics sink for tests and the Prometheus example adapter. */
export function createMemoryMetrics(): MetricsSink & { points: readonly MetricPoint[] } {
  const points: MetricPoint[] = [];
  return {
    points,
    counter(name, value, labels = {}) {
      points.push({ kind: "counter", name, value, labels });
    },
    gauge(name, value, labels = {}) {
      points.push({ kind: "gauge", name, value, labels });
    },
    histogram(name, value, labels = {}) {
      points.push({ kind: "histogram", name, value, labels });
    },
  };
}

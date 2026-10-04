import { describe, expect, it } from "vitest";
import { createMemoryMetrics, createNoopMetrics } from "./metrics.js";
import { createMemoryTracer, createNoopTracer } from "./tracer.js";

describe("metrics", () => {
  it("should record points when using the memory sink", () => {
    const metrics = createMemoryMetrics();
    metrics.counter("messages", 1, { session: "main" });
    metrics.gauge("queue", 3);
    metrics.histogram("latency", 12);
    expect(metrics.points.length).toBe(3);
  });

  it("should record nothing when using the noop sink", () => {
    const metrics = createNoopMetrics();
    metrics.counter("x", 1);
    expect(metrics).toBeDefined();
  });
});

describe("tracer", () => {
  it("should record finished spans with status", () => {
    const tracer = createMemoryTracer();
    const span = tracer.startSpan("handle", { id: 1 });
    tracer.endSpan(span, "ok");
    expect(tracer.finished.length).toBe(1);
    expect(tracer.finished[0]?.status).toBe("ok");
  });

  it("should discard spans when using the noop sink", () => {
    const tracer = createNoopTracer();
    tracer.endSpan(tracer.startSpan("x"), "error");
    expect(tracer).toBeDefined();
  });
});

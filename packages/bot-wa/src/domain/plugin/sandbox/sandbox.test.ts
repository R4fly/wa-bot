import { describe, expect, it } from "vitest";
import { createMemoryChannelPair } from "./channel.js";
import { isApiResultFrame, isHostToWorkerFrame, isWorkerToHostFrame } from "./types.js";

describe("sandbox channel", () => {
  it("should deliver a line from host to worker", () => {
    const pair = createMemoryChannelPair();
    let received = "";
    pair.worker.onLine((line) => {
      received = line;
    });
    pair.host.send("hello");
    expect(received).toBe("hello");
  });

  it("should deliver a line from worker to host", () => {
    const pair = createMemoryChannelPair();
    let received = "";
    pair.host.onLine((line) => {
      received = line;
    });
    pair.worker.send("world");
    expect(received).toBe("world");
  });

  it("should report closed as true after close is called", () => {
    const pair = createMemoryChannelPair();
    expect(pair.host.closed).toBe(false);
    pair.host.close();
    expect(pair.host.closed).toBe(true);
  });

  it("should invoke close handlers when close is called", () => {
    const pair = createMemoryChannelPair();
    let closed = false;
    pair.host.onClose(() => {
      closed = true;
    });
    pair.host.close();
    expect(closed).toBe(true);
  });

  it("should not deliver lines after close is called", () => {
    const pair = createMemoryChannelPair();
    let received = "";
    pair.worker.onLine((line) => {
      received = line;
    });
    pair.host.close();
    pair.host.send("late");
    expect(received).toBe("");
  });
});

describe("frame schema guards", () => {
  it("should reject a host frame with an unknown handler name", () => {
    expect(isHostToWorkerFrame({ kind: "invoke-handler", callId: "c", handler: "nope" })).toBe(false);
  });

  it("should reject a host frame without a call id", () => {
    expect(isHostToWorkerFrame({ kind: "invoke-handler", handler: "activate" })).toBe(false);
  });

  it("should accept a well formed host frame", () => {
    expect(isHostToWorkerFrame({ kind: "invoke-handler", handler: "activate", callId: "c", payload: {} })).toBe(true);
  });

  it("should reject a worker violation frame without a reason", () => {
    expect(isWorkerToHostFrame({ kind: "violation" })).toBe(false);
  });

  it("should reject a worker api call frame without an api name", () => {
    expect(isWorkerToHostFrame({ kind: "api-call", callId: "c" })).toBe(false);
  });

  it("should reject a worker handler result frame without ok", () => {
    expect(isWorkerToHostFrame({ kind: "handler-result", callId: "c" })).toBe(false);
  });

  it("should reject an api result frame without a call id", () => {
    expect(isApiResultFrame({ kind: "api-result", ok: true })).toBe(false);
  });

  it("should accept a well formed api result frame", () => {
    expect(isApiResultFrame({ kind: "api-result", callId: "c", ok: true })).toBe(true);
  });
});
import { describe, expect, it } from "vitest";
import type { NormalizedMessageEvent } from "../../adapters/contract.js";
import { createEventBus } from "./bus.js";

function fakeMessage(body: string): NormalizedMessageEvent {
  return {
    kind: "message",
    sessionId: "s",
    messageId: "m",
    senderJid: "u@example",
    chatJid: "u@example",
    body,
    timestamp: 0,
    isGroup: false,
  };
}

describe("TypedEventBus", () => {
  it("should deliver a named event to its listener", () => {
    const bus = createEventBus();
    const received: NormalizedMessageEvent[] = [];
    bus.on("message", (event) => {
      received.push(event);
    });
    bus.emit("message", fakeMessage("hi"));
    expect(received.length).toBe(1);
    expect(received[0]?.body).toBe("hi");
  });

  it("should deliver a named event to a wildcard listener", () => {
    const bus = createEventBus();
    const received: string[] = [];
    bus.onWildcard((name) => {
      received.push(name);
    });
    bus.emit("message", fakeMessage("x"));
    expect(received).toEqual(["message"]);
  });

  it("should isolate errors between named listeners", () => {
    const bus = createEventBus();
    const reached: string[] = [];
    bus.on("message", () => {
      throw new Error("boom");
    });
    bus.on("message", () => {
      reached.push("second");
    });
    bus.emit("message", fakeMessage("x"));
    expect(reached).toEqual(["second"]);
  });

  it("should isolate errors between wildcard listeners", () => {
    const bus = createEventBus();
    const reached: string[] = [];
    bus.onWildcard(() => {
      throw new Error("boom");
    });
    bus.onWildcard(() => {
      reached.push("second");
    });
    bus.emit("message", fakeMessage("x"));
    expect(reached).toEqual(["second"]);
  });

  it("should run a wildcard listener only once when registered with once", () => {
    const bus = createEventBus();
    const received: string[] = [];
    bus.onWildcard(() => {
      received.push("hit");
    }, { once: true });
    bus.emit("message", fakeMessage("x"));
    bus.emit("message", fakeMessage("y"));
    expect(received.length).toBe(1);
  });

  it("should stop delivery when a named listener unsubscribes", () => {
    const bus = createEventBus();
    const received: string[] = [];
    const off = bus.on("message", () => {
      received.push("hit");
    });
    off();
    bus.emit("message", fakeMessage("x"));
    expect(received.length).toBe(0);
  });

  it("should stop delivery when a wildcard listener unsubscribes", () => {
    const bus = createEventBus();
    const received: string[] = [];
    const off = bus.onWildcard(() => {
      received.push("hit");
    });
    off();
    bus.emit("message", fakeMessage("x"));
    expect(received.length).toBe(0);
  });

  it("should run wildcard listeners in descending priority", () => {
    const bus = createEventBus();
    const order: string[] = [];
    bus.onWildcard(() => order.push("low"), { priority: 1 });
    bus.onWildcard(() => order.push("high"), { priority: 10 });
    bus.emit("message", fakeMessage("x"));
    expect(order).toEqual(["high", "low"]);
  });
});
import { describe, expect, it } from "vitest";
import type { NormalizedMessageEvent } from "../../adapters/contract.js";
import { createEventBus } from "./bus.js";

function fakeMessage(body: string): NormalizedMessageEvent {
  return {
    kind: "message",
    sessionId: "s1",
    messageId: "m1",
    senderJid: "a@example",
    chatJid: "a@example",
    body,
    timestamp: 0,
    isGroup: false,
  };
}

describe("TypedEventBus", () => {
  it("should run higher priority listeners first when emitting", () => {
    const bus = createEventBus();
    const order: string[] = [];
    bus.on("message", () => order.push("low"), { priority: 1 });
    bus.on("message", () => order.push("high"), { priority: 10 });
    bus.emit("message", fakeMessage("x"));
    expect(order).toEqual(["high", "low"]);
  });

  it("should run a once listener only one time when emitting twice", () => {
    const bus = createEventBus();
    let count = 0;
    bus.on("message", () => {
      count += 1;
    }, { once: true });
    bus.emit("message", fakeMessage("x"));
    bus.emit("message", fakeMessage("y"));
    expect(count).toBe(1);
  });

  it("should isolate a throwing listener and still run the next one", () => {
    const errors: unknown[] = [];
    const bus = createEventBus({
      onError: (error) => {
        errors.push(error);
      },
    });
    let second = 0;
    bus.on("message", () => {
      throw new Error("boom");
    });
    bus.on("message", () => {
      second += 1;
    });
    bus.emit("message", fakeMessage("x"));
    expect(errors.length).toBe(1);
    expect(second).toBe(1);
  });

  it("should receive every event name when registered as wildcard", () => {
    const bus = createEventBus();
    const names: string[] = [];
    bus.onWildcard((name) => {
      names.push(name);
    });
    bus.emit("message", fakeMessage("x"));
    bus.emit("connection", { kind: "connection", sessionId: "s1", status: "connected" });
    expect(names).toEqual(["message", "connection"]);
  });
});

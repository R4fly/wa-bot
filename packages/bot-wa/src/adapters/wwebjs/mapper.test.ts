import { describe, expect, it } from "vitest";
import { mapDisconnected, mapMessage, mapQr, mapReady } from "./mapper.js";

describe("wwebjs mapper", () => {
  it("should extract body and group flag when mapping a message payload", () => {
    const payload = {
      id: { _serialized: "M1" },
      from: "123@g.us",
      author: "456@s.whatsapp.net",
      body: "hello",
      timestamp: 100,
    };
    const event = mapMessage(payload, "s1");
    expect(event?.body).toBe("hello");
    expect(event?.isGroup).toBe(true);
    expect(event?.senderJid).toBe("456@s.whatsapp.net");
  });

  it("should return null when the payload is not an object", () => {
    expect(mapMessage("nope", "s1")).toBeNull();
    expect(mapMessage(null, "s1")).toBeNull();
  });

  it("should map a qr string payload to an auth pending event", () => {
    expect(mapQr("QRDATA", "s1")).toEqual({
      kind: "auth",
      sessionId: "s1",
      status: "pending",
      qr: "QRDATA",
    });
  });

  it("should return null when the qr payload is empty", () => {
    expect(mapQr("", "s1")).toBeNull();
  });

  it("should map ready and disconnected signals to connection events", () => {
    expect(mapReady("s1")).toEqual({ kind: "connection", sessionId: "s1", status: "connected" });
    expect(mapDisconnected("s1")).toEqual({
      kind: "connection",
      sessionId: "s1",
      status: "disconnected",
    });
  });
});

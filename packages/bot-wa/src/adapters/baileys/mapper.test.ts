import { describe, expect, it } from "vitest";
import { mapConnectionUpdate, mapMessagesUpsert } from "./mapper.js";

describe("baileys mapper", () => {
  it("should extract body and group flag when mapping an upsert payload", () => {
    const payload = {
      messages: [
        {
          key: { remoteJid: "123@g.us", participant: "456@s.whatsapp.net", id: "M1" },
          message: { conversation: "hello" },
          messageTimestamp: 100,
        },
      ],
    };
    const events = mapMessagesUpsert(payload, "s1");
    expect(events.length).toBe(1);
    expect(events[0]?.body).toBe("hello");
    expect(events[0]?.isGroup).toBe(true);
    expect(events[0]?.senderJid).toBe("456@s.whatsapp.net");
  });

  it("should return an empty list when the payload has no messages", () => {
    expect(mapMessagesUpsert({ other: 1 }, "s1")).toEqual([]);
    expect(mapMessagesUpsert(null, "s1")).toEqual([]);
  });

  it("should map qr updates to auth pending events", () => {
    const event = mapConnectionUpdate({ qr: "QRDATA" }, "s1");
    expect(event).toEqual({ kind: "auth", sessionId: "s1", status: "pending", qr: "QRDATA" });
  });

  it("should map close updates to disconnected events", () => {
    const event = mapConnectionUpdate({ connection: "close" }, "s1");
    expect(event).toEqual({ kind: "connection", sessionId: "s1", status: "disconnected" });
  });
});

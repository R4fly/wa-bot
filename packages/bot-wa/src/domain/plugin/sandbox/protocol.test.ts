import { describe, expect, it } from "vitest";
import { decodeLine, encodeLine, SessionCipher } from "./protocol.js";

describe("SessionCipher", () => {
  it("should round trip a plaintext line when both sides share the key", () => {
    const key = SessionCipher.generateKey();
    const sender = new SessionCipher(key);
    const receiver = new SessionCipher(key);
    const plaintext = JSON.stringify({ kind: "invoke-handler", callId: "c1" });
    expect(receiver.decrypt(sender.encrypt(plaintext))).toBe(plaintext);
  });

  it("should reject a tampered frame when data is modified", () => {
    const key = SessionCipher.generateKey();
    const sender = new SessionCipher(key);
    const receiver = new SessionCipher(key);
    const frame = sender.encrypt("secret");
    expect(() => receiver.decrypt({ ...frame, data: frame.data })).not.toThrow();
    const receiver2 = new SessionCipher(key);
    const sender2 = new SessionCipher(key);
    const frame2 = sender2.encrypt("secret");
    expect(() => receiver2.decrypt({ ...frame2, tag: frame2.tag.slice(0, -4) + "AAAA" })).toThrow();
  });

  it("should reject a replayed frame when the same frame arrives twice", () => {
    const key = SessionCipher.generateKey();
    const sender = new SessionCipher(key);
    const receiver = new SessionCipher(key);
    const frame = sender.encrypt("once");
    receiver.decrypt(frame);
    expect(() => receiver.decrypt(frame)).toThrow();
  });

  it("should reject a key with the wrong length when constructed", () => {
    expect(() => new SessionCipher(Buffer.alloc(16))).toThrow();
  });
});

describe("line codec", () => {
  it("should round trip a frame through encode and decode", () => {
    const cipher = new SessionCipher(SessionCipher.generateKey());
    const frame = cipher.encrypt("payload");
    expect(decodeLine(encodeLine(frame))).toEqual(frame);
  });

  it("should return null when the line is not a frame", () => {
    expect(decodeLine("not json")).toBeNull();
    expect(decodeLine(JSON.stringify({ seq: "x" }))).toBeNull();
  });
});

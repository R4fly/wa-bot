import { describe, expect, it } from "vitest";
import type { NormalizedMessageEvent } from "../../adapters/contract.js";
import { checkMedia, detectMediaType } from "./media.js";
import { createMessageView } from "./normalizer.js";

function event(body: string, quotedMessageId?: string): NormalizedMessageEvent {
  return {
    kind: "message",
    sessionId: "s",
    messageId: "m",
    senderJid: "u@example",
    chatJid: "u@example",
    body,
    timestamp: 5,
    isGroup: false,
    ...(quotedMessageId === undefined ? {} : { quotedMessageId }),
  };
}

describe("createMessageView", () => {
  it("should trim the body when normalizing", () => {
    expect(createMessageView(event("  hi  ")).body).toBe("hi");
  });

  it("should carry the quoted message id when present", () => {
    expect(createMessageView(event("hi", "q1")).quotedMessageId).toBe("q1");
  });

  it("should leave the quoted message id absent when not present", () => {
    expect(createMessageView(event("hi")).quotedMessageId).toBeUndefined();
  });
});

describe("detectMediaType", () => {
  it("should map webp to sticker and jpeg to image", () => {
    expect(detectMediaType("image/webp")).toBe("sticker");
    expect(detectMediaType("image/jpeg")).toBe("image");
  });

  it("should map video and audio prefixes", () => {
    expect(detectMediaType("video/mp4")).toBe("video");
    expect(detectMediaType("audio/ogg")).toBe("audio");
  });

  it("should map vcard and contact mime types", () => {
    expect(detectMediaType("text/vcard")).toBe("vcard");
    expect(detectMediaType("text/x-vcard")).toBe("vcard");
    expect(detectMediaType("text/directory")).toBe("contact");
    expect(detectMediaType("application/contact+json")).toBe("contact");
  });

  it("should map location and document mime types", () => {
    expect(detectMediaType("application/vnd.geo+json")).toBe("location");
    expect(detectMediaType("application/pdf")).toBe("document");
  });

  it("should map an unrecognized mime type to unknown", () => {
    expect(detectMediaType("text/plain")).toBe("unknown");
  });
});

describe("checkMedia", () => {
  it("should reject a denied mime before size checks", () => {
    const decision = checkMedia(
      { mime: "application/octet-stream", sizeBytes: 10 },
      { maxBytes: 100, denyMime: ["application/octet-stream"] },
    );
    expect(decision).toEqual({ accepted: false, reason: "mime-denied" });
  });

  it("should reject an oversize attachment", () => {
    const decision = checkMedia({ mime: "image/jpeg", sizeBytes: 200 }, { maxBytes: 100 });
    expect(decision).toEqual({ accepted: false, reason: "size-exceeded" });
  });

  it("should reject a mime outside the allow list", () => {
    const decision = checkMedia(
      { mime: "video/mp4", sizeBytes: 10 },
      { maxBytes: 100, allowMime: ["image/jpeg"] },
    );
    expect(decision).toEqual({ accepted: false, reason: "mime-not-allowed" });
  });

  it("should accept a mime inside the allow list within the size limit", () => {
    const decision = checkMedia(
      { mime: "image/jpeg", sizeBytes: 10 },
      { maxBytes: 100, allowMime: ["image/jpeg"] },
    );
    expect(decision).toEqual({ accepted: true });
  });

  it("should accept any mime when no lists are configured", () => {
    const decision = checkMedia({ mime: "text/plain", sizeBytes: 1 }, { maxBytes: 10 });
    expect(decision).toEqual({ accepted: true });
  });
});

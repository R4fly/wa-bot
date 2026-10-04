import { describe, expect, it } from "vitest";
import type { NormalizedMessageEvent } from "../../adapters/contract.js";
import { checkMedia, detectMediaType } from "./media.js";
import { createMessageView } from "./normalizer.js";

function event(body: string): NormalizedMessageEvent {
  return {
    kind: "message",
    sessionId: "s",
    messageId: "m",
    senderJid: "u@example",
    chatJid: "u@example",
    body,
    timestamp: 5,
    isGroup: false,
  };
}

describe("createMessageView", () => {
  it("should trim the body when normalizing", () => {
    expect(createMessageView(event("  hi  ")).body).toBe("hi");
  });
});

describe("detectMediaType", () => {
  it("should map webp to sticker and jpeg to image", () => {
    expect(detectMediaType("image/webp")).toBe("sticker");
    expect(detectMediaType("image/jpeg")).toBe("image");
    expect(detectMediaType("audio/ogg")).toBe("audio");
    expect(detectMediaType("application/pdf")).toBe("document");
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
});

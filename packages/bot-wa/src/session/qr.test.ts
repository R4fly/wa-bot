import { describe, expect, it } from "vitest";
import { qrBase64, qrRaw } from "./qr.js";

describe("qr helpers", () => {
  it("should return the payload unchanged when raw is requested", () => {
    expect(qrRaw("abc123")).toBe("abc123");
  });

  it("should round trip when base64 is decoded", () => {
    const encoded = qrBase64("pair-payload");
    expect(Buffer.from(encoded, "base64").toString("utf8")).toBe("pair-payload");
  });
});

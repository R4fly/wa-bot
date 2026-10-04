import { describe, expect, it } from "vitest";
import { keyFingerprint, sha256Hex } from "./hash.js";

describe("sha256Hex", () => {
  it("should match the known vector for the string abc", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("should produce the same digest for equal byte content", () => {
    expect(sha256Hex(new Uint8Array([97, 98, 99]))).toBe(sha256Hex("abc"));
  });
});

describe("keyFingerprint", () => {
  it("should return 16 hex characters when derived from a key", () => {
    const fingerprint = keyFingerprint("QUJD");
    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
  });
});

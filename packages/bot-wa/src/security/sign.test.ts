import { describe, expect, it } from "vitest";
import { generateSigningKeypair, signPayload, verifySignature } from "./sign.js";

describe("Ed25519 signing", () => {
  it("should verify a signature produced by the matching private key", () => {
    const keypair = generateSigningKeypair();
    const signature = signPayload("payload-hash", keypair.privateKeyBase64);
    expect(verifySignature("payload-hash", signature, keypair.publicKeyBase64)).toBe(true);
  });

  it("should reject a signature when the payload is tampered", () => {
    const keypair = generateSigningKeypair();
    const signature = signPayload("payload-hash", keypair.privateKeyBase64);
    expect(verifySignature("payload-hash-x", signature, keypair.publicKeyBase64)).toBe(false);
  });

  it("should reject a signature when verified with a different public key", () => {
    const signer = generateSigningKeypair();
    const other = generateSigningKeypair();
    const signature = signPayload("payload-hash", signer.privateKeyBase64);
    expect(verifySignature("payload-hash", signature, other.publicKeyBase64)).toBe(false);
  });

  it("should return false when the public key is malformed", () => {
    expect(verifySignature("payload", "c2ln", "not-base64-der")).toBe(false);
  });
});

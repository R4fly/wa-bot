import { createHash } from "node:crypto";

/** Computes the SHA-256 digest of a string or byte array, hex encoded. */
export function sha256Hex(data: Uint8Array | string): string {
  const hash = createHash("sha256");
  hash.update(typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data));
  return hash.digest("hex");
}

/** Derives a 16 hex character fingerprint from a base64 public key, for display and storage keys. */
export function keyFingerprint(publicKeyBase64: string): string {
  return sha256Hex(publicKeyBase64).slice(0, 16);
}

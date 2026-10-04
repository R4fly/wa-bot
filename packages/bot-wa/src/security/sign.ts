import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";

/** Ed25519 keypair with DER keys encoded as base64, matching manifest fields. */
export interface SigningKeypair {
  readonly publicKeyBase64: string;
  readonly privateKeyBase64: string;
}

/** Generates an Ed25519 keypair for plugin publishing. */
export function generateSigningKeypair(): SigningKeypair {
  const pair = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  return {
    publicKeyBase64: pair.publicKey.toString("base64"),
    privateKeyBase64: pair.privateKey.toString("base64"),
  };
}

/** Signs a payload string with an Ed25519 private key, signature as base64. */
export function signPayload(payload: string, privateKeyBase64: string): string {
  const key = createPrivateKey({
    key: Buffer.from(privateKeyBase64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  return cryptoSign(null, Buffer.from(payload, "utf8"), key).toString("base64");
}

/** Verifies an Ed25519 signature over a payload string. Returns false on any malformed input. */
export function verifySignature(payload: string, signatureBase64: string, publicKeyBase64: string): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });
    return cryptoVerify(null, Buffer.from(payload, "utf8"), key, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SandboxError } from "../../../kernel/errors/index.js";

/** One authenticated encrypted line on the host to sandbox channel. */
export interface CipherFrame {
  readonly seq: number;
  readonly iv: string;
  readonly tag: string;
  readonly data: string;
}

/**
 * AES-256-GCM session cipher with per direction sequence numbers bound into
 * the additional authenticated data. Provides channel authenticity and
 * integrity plus confidentiality between host and sandbox. Isolation itself
 * comes from the process boundary, not from this cipher.
 */
export class SessionCipher {
  private readonly key: Buffer;
  private sendSeq = 0;
  private recvSeq = 0;

  constructor(key: Buffer) {
    if (key.length !== 32) {
      throw new SandboxError({
        message: "session cipher key must be 32 bytes",
        context: { bytes: key.length },
      });
    }
    this.key = key;
  }

  /** Generates a CSPRNG session key. Never persisted. */
  static generateKey(): Buffer {
    return randomBytes(32);
  }

  /** Encrypts and authenticates one plaintext line. */
  encrypt(plaintext: string): CipherFrame {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(`seq:${this.sendSeq}`, "utf8"));
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const frame: CipherFrame = {
      seq: this.sendSeq,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64"),
    };
    this.sendSeq += 1;
    return frame;
  }

  /** Decrypts and verifies one frame. Rejects replayed or reordered frames. */
  decrypt(frame: CipherFrame): string {
    if (frame.seq !== this.recvSeq) {
      throw new SandboxError({
        message: `channel frame out of order: expected ${this.recvSeq}, got ${frame.seq}`,
        context: { expected: this.recvSeq, got: frame.seq },
      });
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(frame.iv, "base64"));
    decipher.setAAD(Buffer.from(`seq:${frame.seq}`, "utf8"));
    decipher.setAuthTag(Buffer.from(frame.tag, "base64"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(frame.data, "base64")),
      decipher.final(),
    ]);
    this.recvSeq += 1;
    return plain.toString("utf8");
  }
}

/** Serializes a cipher frame to one line. */
export function encodeLine(frame: CipherFrame): string {
  return JSON.stringify(frame);
}

/** Parses one line into a cipher frame. Returns null when malformed. */
export function decodeLine(line: string): CipherFrame | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record["seq"] !== "number" ||
    typeof record["iv"] !== "string" ||
    typeof record["tag"] !== "string" ||
    typeof record["data"] !== "string"
  ) {
    return null;
  }
  return {
    seq: record["seq"],
    iv: record["iv"],
    tag: record["tag"],
    data: record["data"],
  };
}

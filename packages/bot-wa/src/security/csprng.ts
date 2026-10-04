import { randomBytes, randomUUID } from "node:crypto";

/** Returns a CSPRNG UUID v4. The only allowed source of random identifiers. */
export function randomId(): string {
  return randomUUID();
}

/** Returns CSPRNG bytes encoded as lowercase hex. */
export function randomHex(byteLength: number): string {
  return randomBytes(byteLength).toString("hex");
}

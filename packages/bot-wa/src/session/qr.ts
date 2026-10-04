/** Returns the QR payload unchanged for raw consumers. */
export function qrRaw(qr: string): string {
  return qr;
}

/** Encodes the QR payload as base64 for transport or consumer side rendering. */
export function qrBase64(qr: string): string {
  return Buffer.from(qr, "utf8").toString("base64");
}

import type {
  NormalizedAuthEvent,
  NormalizedConnectionEvent,
  NormalizedMessageEvent,
} from "../contract.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

/** Normalizes a whatsapp-web.js message payload into a domain message event. */
export function mapMessage(payload: unknown, sessionId: string): NormalizedMessageEvent | null {
  const record = asRecord(payload);
  if (record === undefined) {
    return null;
  }
  const id = asRecord(record["id"]);
  const messageId = id !== undefined && typeof id["_serialized"] === "string" ? id["_serialized"] : "";
  const chatJid = typeof record["from"] === "string" ? record["from"] : "";
  const author = typeof record["author"] === "string" ? record["author"] : chatJid;
  const body = typeof record["body"] === "string" ? record["body"] : "";
  const rawTimestamp = record["timestamp"];
  const timestamp =
    typeof rawTimestamp === "number"
      ? rawTimestamp
      : typeof rawTimestamp === "string"
        ? Number(rawTimestamp)
        : 0;
  return {
    kind: "message",
    sessionId,
    messageId,
    senderJid: author,
    chatJid,
    body,
    timestamp,
    isGroup: chatJid.endsWith("@g.us"),
  };
}

/** Normalizes a whatsapp-web.js qr payload, which is the QR string itself. */
export function mapQr(payload: unknown, sessionId: string): NormalizedAuthEvent | null {
  if (typeof payload !== "string" || payload.length === 0) {
    return null;
  }
  return { kind: "auth", sessionId, status: "pending", qr: payload };
}

/** Builds the connected connection event emitted on the ready signal. */
export function mapReady(sessionId: string): NormalizedConnectionEvent {
  return { kind: "connection", sessionId, status: "connected" };
}

/** Builds the disconnected connection event emitted on the disconnected signal. */
export function mapDisconnected(sessionId: string): NormalizedConnectionEvent {
  return { kind: "connection", sessionId, status: "disconnected" };
}

import type {
  NormalizedAuthEvent,
  NormalizedConnectionEvent,
  NormalizedMessageEvent,
} from "../contract.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function textOf(message: unknown): string {
  const record = asRecord(message);
  if (record === undefined) {
    return "";
  }
  if (typeof record["conversation"] === "string") {
    return record["conversation"];
  }
  const extended = asRecord(record["extendedTextMessage"]);
  if (extended !== undefined && typeof extended["text"] === "string") {
    return extended["text"];
  }
  return "";
}

/** Normalizes a Baileys messages.upsert payload into domain message events. */
export function mapMessagesUpsert(payload: unknown, sessionId: string): readonly NormalizedMessageEvent[] {
  const root = asRecord(payload);
  const messages = root === undefined ? undefined : root["messages"];
  if (!Array.isArray(messages)) {
    return [];
  }
  const out: NormalizedMessageEvent[] = [];
  for (const item of messages) {
    const message = asRecord(item);
    if (message === undefined) {
      continue;
    }
    const key = asRecord(message["key"]);
    const chatJid = key !== undefined && typeof key["remoteJid"] === "string" ? key["remoteJid"] : "";
    const senderJid =
      key !== undefined && typeof key["participant"] === "string" ? key["participant"] : chatJid;
    const messageId = key !== undefined && typeof key["id"] === "string" ? key["id"] : "";
    const rawTimestamp = message["messageTimestamp"];
    const timestamp =
      typeof rawTimestamp === "number"
        ? rawTimestamp
        : typeof rawTimestamp === "string"
          ? Number(rawTimestamp)
          : 0;
    out.push({
      kind: "message",
      sessionId,
      messageId,
      senderJid,
      chatJid,
      body: textOf(message["message"]),
      timestamp,
      isGroup: chatJid.endsWith("@g.us"),
    });
  }
  return out;
}

/**
 * Normalizes a Baileys connection.update payload. A qr field produces an auth
 * pending event, otherwise the connection status is mapped.
 */
export function mapConnectionUpdate(
  payload: unknown,
  sessionId: string,
): NormalizedConnectionEvent | NormalizedAuthEvent | null {
  const root = asRecord(payload);
  if (root === undefined) {
    return null;
  }
  if (typeof root["qr"] === "string" && root["qr"].length > 0) {
    return { kind: "auth", sessionId, status: "pending", qr: root["qr"] };
  }
  const connection = root["connection"];
  if (connection === "open") {
    return { kind: "connection", sessionId, status: "connected" };
  }
  if (connection === "connecting") {
    return { kind: "connection", sessionId, status: "reconnecting" };
  }
  if (connection === "close") {
    return { kind: "connection", sessionId, status: "disconnected" };
  }
  return null;
}

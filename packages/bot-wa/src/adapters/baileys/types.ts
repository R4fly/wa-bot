/**
 * Minimal structural surface of a Baileys socket used by this adapter.
 * Keeping the surface narrow isolates upstream type churn behind one file.
 */
export interface BaileysSocketLike {
  on(event: "messages.upsert", handler: (payload: unknown) => void): void;
  on(event: "connection.update", handler: (payload: unknown) => void): void;
  sendMessage(jid: string, content: { text: string }): Promise<{ key?: { id?: string } }>;
  sendEdit(jid: string, messageId: string, text: string): Promise<void>;
  sendReaction(jid: string, messageId: string, emoji: string): Promise<void>;
  sendDelete(jid: string, messageId: string): Promise<void>;
  groupMetadata(jid: string): Promise<{ participants: readonly { id: string }[] }>;
  groupUpdateSubject(jid: string, subject: string): Promise<void>;
  getName(jid: string): Promise<string>;
  downloadMedia(messageId: string): Promise<Uint8Array>;
  end(): Promise<void>;
}

/** Produces a socket. Tests inject a mock. Production imports the real package. */
export type BaileysSocketFactory = () => Promise<BaileysSocketLike>;

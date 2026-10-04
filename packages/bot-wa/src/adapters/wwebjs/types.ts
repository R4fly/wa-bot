/** Reference to one whatsapp-web.js message with mutation operations. */
export interface WWebJsMessageRef {
  edit(text: string): Promise<void>;
  react(emoji: string): Promise<void>;
  delete(forEveryone: boolean): Promise<void>;
}

/**
 * Minimal structural surface of a whatsapp-web.js client used by this adapter.
 * Keeping the surface narrow isolates upstream type churn behind one file.
 */
export interface WWebJsClientLike {
  on(event: "message", handler: (payload: unknown) => void): void;
  on(event: "qr", handler: (payload: unknown) => void): void;
  on(event: "ready", handler: () => void): void;
  on(event: "disconnected", handler: () => void): void;
  sendMessage(chatId: string, text: string): Promise<{ id?: { _serialized?: string } }>;
  editMessage(messageId: string, text: string): Promise<void>;
  reactToMessage(messageId: string, emoji: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
  getChatParticipants(chatId: string): Promise<readonly string[]>;
  setChatSubject(chatId: string, subject: string): Promise<void>;
  getContactName(contactId: string): Promise<string>;
  downloadMedia(messageId: string): Promise<Uint8Array>;
  destroy(): Promise<void>;
}

/** Produces a client. Tests inject a mock. Production imports the real package lazily. */
export type WWebJsClientFactory = () => Promise<WWebJsClientLike>;

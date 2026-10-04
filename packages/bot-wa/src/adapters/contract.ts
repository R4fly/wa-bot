/** Engine names supported in v1. */
export type EngineName = "baileys" | "wwebjs";

/** Capability flags reported by every adapter. Silent fallback is forbidden. */
export interface CapabilityFlags {
  readonly supportsPairingCode: boolean;
  readonly supportsEdit: boolean;
  readonly supportsReaction: boolean;
  readonly supportsDelete: boolean;
  readonly supportsGroupAdmin: boolean;
  readonly supportsPresence: boolean;
  readonly supportsCallEvents: boolean;
  readonly supportsMultiDevice: boolean;
}

/** Normalized inbound message event. */
export interface NormalizedMessageEvent {
  readonly kind: "message";
  readonly sessionId: string;
  readonly messageId: string;
  readonly senderJid: string;
  readonly chatJid: string;
  readonly body: string;
  readonly timestamp: number;
  readonly isGroup: boolean;
  readonly quotedMessageId?: string;
}

/** Normalized connection event. */
export interface NormalizedConnectionEvent {
  readonly kind: "connection";
  readonly sessionId: string;
  readonly status: "connected" | "disconnected" | "reconnecting";
}

/** Normalized auth event. QR and pairing code values are secrets and must be redacted in logs. */
export interface NormalizedAuthEvent {
  readonly kind: "auth";
  readonly sessionId: string;
  readonly status: "pending" | "ready" | "expired";
  readonly qr?: string;
  readonly pairingCode?: string;
}

/** Union of all normalized events emitted by adapters. */
export type NormalizedEvent = NormalizedMessageEvent | NormalizedConnectionEvent | NormalizedAuthEvent;

/** Handler for normalized events. Returns an unsubscribe function. */
export type EventHandler = (event: NormalizedEvent) => void;

/** Connection status reported by an adapter. */
export type ConnectionStatus = "connected" | "disconnected" | "connecting";

/**
 * The engine adapter contract. Five groups: lifecycle, send, group, media,
 * contact and profile, plus events and auth. QR and pairing code methods are
 * optional because not every engine exposes them. Adapters contain zero
 * business logic and must pass the identical contract test suite.
 */
export interface EngineAdapter {
  readonly name: EngineName;
  readonly capabilities: CapabilityFlags;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getConnectionStatus(): ConnectionStatus;

  sendMessage(target: string, text: string): Promise<string>;
  editMessage(messageId: string, text: string): Promise<void>;
  reactToMessage(messageId: string, emoji: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;

  groupParticipants(chatJid: string): Promise<readonly string[]>;
  groupSetSubject(chatJid: string, subject: string): Promise<void>;

  downloadMedia(messageId: string): Promise<Uint8Array>;

  getProfileName(jid: string): Promise<string>;

  onEvent(handler: EventHandler): () => void;

  getAuthState(): Promise<unknown>;
  setAuthState(state: unknown): Promise<void>;

  requestQR?(): Promise<string>;
  requestPairingCode?(phone: string): Promise<string>;
}

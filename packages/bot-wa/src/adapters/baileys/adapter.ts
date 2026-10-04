import { randomUUID } from "node:crypto";
import { EngineError, wrapEngineError } from "../../kernel/errors/index.js";
import type {
  CapabilityFlags,
  ConnectionStatus,
  EngineAdapter,
  EventHandler,
  NormalizedEvent,
} from "../contract.js";
import { mapConnectionUpdate, mapMessagesUpsert } from "./mapper.js";
import type { BaileysSocketFactory, BaileysSocketLike } from "./types.js";

const BAILEYS_PACKAGE = "@whiskeysockets/baileys";

const BAILEYS_CAPABILITIES: CapabilityFlags = {
  supportsPairingCode: true,
  supportsEdit: true,
  supportsReaction: true,
  supportsDelete: true,
  supportsGroupAdmin: true,
  supportsPresence: true,
  supportsCallEvents: true,
  supportsMultiDevice: true,
};

interface RawSocketShape {
  ev: { on(event: string, handler: (payload: unknown) => void): void };
  sendMessage(jid: string, content: unknown): Promise<{ key?: { id?: string } }>;
  groupMetadata(jid: string): Promise<{ participants: readonly { id: string }[] }>;
  groupUpdateSubject(jid: string, subject: string): Promise<void>;
  getName(jid: string): Promise<string>;
  end(): Promise<void>;
}

function wrapRawSocket(raw: unknown): BaileysSocketLike {
  const socket = raw as RawSocketShape;
  if (typeof socket.sendMessage !== "function" || typeof socket.ev?.on !== "function") {
    throw new EngineError({
      message: "baileys socket shape mismatch, the installed version is not compatible",
      context: { engine: "baileys" },
    });
  }
  return {
    on(event, handler) {
      socket.ev.on(event, handler);
    },
    async sendMessage(jid, content) {
      return socket.sendMessage(jid, content);
    },
    async sendEdit(jid, messageId, text) {
      await socket.sendMessage(jid, { text, edit: { id: messageId, remoteJid: jid } });
    },
    async sendReaction(jid, messageId, emoji) {
      await socket.sendMessage(jid, { react: { text: emoji, key: { id: messageId, remoteJid: jid } } });
    },
    async sendDelete(jid, messageId) {
      await socket.sendMessage(jid, { delete: { id: messageId, remoteJid: jid } });
    },
    async groupMetadata(jid) {
      return socket.groupMetadata(jid);
    },
    async groupUpdateSubject(jid, subject) {
      await socket.groupUpdateSubject(jid, subject);
    },
    async getName(jid) {
      return socket.getName(jid);
    },
    async downloadMedia() {
      throw new EngineError({
        message: "baileys media download requires a message reference and the real package, deferred to the integration phase",
        context: { engine: "baileys" },
      });
    },
    async end() {
      await socket.end();
    },
  };
}

async function defaultSocketFactory(): Promise<BaileysSocketLike> {
  let loaded: unknown;
  try {
    const specifier = BAILEYS_PACKAGE;
    loaded = await import(specifier);
  } catch (cause) {
    throw new EngineError({
      message: `engine baileys requires the package ${BAILEYS_PACKAGE} to be installed`,
      cause,
      context: { engine: "baileys", package: BAILEYS_PACKAGE },
    });
  }
  const api = loaded as { makeWASocket?: (options: unknown) => Promise<unknown> };
  if (typeof api.makeWASocket !== "function") {
    throw new EngineError({
      message: `package ${BAILEYS_PACKAGE} does not export makeWASocket`,
      context: { engine: "baileys" },
    });
  }
  try {
    const raw = await api.makeWASocket({ printQRInTerminal: false });
    return wrapRawSocket(raw);
  } catch (cause) {
    throw wrapEngineError(cause, "baileys socket creation failed");
  }
}

/** Options for the Baileys adapter. socketFactory is the test seam. */
export interface BaileysAdapterOptions {
  readonly sessionId?: string;
  readonly socketFactory?: BaileysSocketFactory;
}

/** Creates the Baileys engine adapter. Zero business logic, contract only. */
export function createBaileysAdapter(options: BaileysAdapterOptions = {}): EngineAdapter {
  const sessionId = options.sessionId ?? "default";
  const factory = options.socketFactory ?? defaultSocketFactory;
  let socket: BaileysSocketLike | null = null;
  let status: ConnectionStatus = "disconnected";
  let handlers: EventHandler[] = [];
  const sentKeys = new Map<string, string>();

  function emit(event: NormalizedEvent): void {
    for (const handler of [...handlers]) {
      handler(event);
    }
  }

  return {
    name: "baileys",
    capabilities: BAILEYS_CAPABILITIES,
    async connect(): Promise<void> {
      status = "connecting";
      try {
        const created = await factory();
        socket = created;
        created.on("messages.upsert", (payload) => {
          for (const event of mapMessagesUpsert(payload, sessionId)) {
            if (event.messageId.length > 0) {
              sentKeys.set(event.messageId, event.chatJid);
            }
            emit(event);
          }
        });
        created.on("connection.update", (payload) => {
          const event = mapConnectionUpdate(payload, sessionId);
          if (event === null) {
            return;
          }
          if (event.kind === "connection") {
            status = event.status === "connected" ? "connected" : event.status === "reconnecting" ? "connecting" : "disconnected";
          }
          emit(event);
        });
      } catch (cause) {
        status = "disconnected";
        throw cause instanceof EngineError ? cause : wrapEngineError(cause, "baileys connect failed");
      }
    },
    async disconnect(): Promise<void> {
      if (socket !== null) {
        await socket.end();
      }
      socket = null;
      status = "disconnected";
    },
    getConnectionStatus(): ConnectionStatus {
      return status;
    },
    async sendMessage(target: string, text: string): Promise<string> {
      if (socket === null) {
        throw new EngineError({ message: "baileys adapter not connected", context: { engine: "baileys" } });
      }
      try {
        const result = await socket.sendMessage(target, { text });
        const id = result.key?.id ?? randomUUID();
        sentKeys.set(id, target);
        return id;
      } catch (cause) {
        throw wrapEngineError(cause, "baileys sendMessage failed");
      }
    },
    async editMessage(messageId: string, text: string): Promise<void> {
      const jid = sentKeys.get(messageId);
      if (socket === null || jid === undefined) {
        throw new EngineError({ message: `unknown message for edit: ${messageId}`, context: { engine: "baileys" } });
      }
      await socket.sendEdit(jid, messageId, text);
    },
    async reactToMessage(messageId: string, emoji: string): Promise<void> {
      const jid = sentKeys.get(messageId);
      if (socket === null || jid === undefined) {
        throw new EngineError({ message: `unknown message for reaction: ${messageId}`, context: { engine: "baileys" } });
      }
      await socket.sendReaction(jid, messageId, emoji);
    },
    async deleteMessage(messageId: string): Promise<void> {
      const jid = sentKeys.get(messageId);
      if (socket === null || jid === undefined) {
        throw new EngineError({ message: `unknown message for delete: ${messageId}`, context: { engine: "baileys" } });
      }
      await socket.sendDelete(jid, messageId);
    },
    async groupParticipants(chatJid: string): Promise<readonly string[]> {
      if (socket === null) {
        throw new EngineError({ message: "baileys adapter not connected", context: { engine: "baileys" } });
      }
      const metadata = await socket.groupMetadata(chatJid);
      return metadata.participants.map((participant) => participant.id);
    },
    async groupSetSubject(chatJid: string, subject: string): Promise<void> {
      if (socket === null) {
        throw new EngineError({ message: "baileys adapter not connected", context: { engine: "baileys" } });
      }
      await socket.groupUpdateSubject(chatJid, subject);
    },
    async downloadMedia(messageId: string): Promise<Uint8Array> {
      if (socket === null) {
        throw new EngineError({ message: "baileys adapter not connected", context: { engine: "baileys" } });
      }
      return socket.downloadMedia(messageId);
    },
    async getProfileName(jid: string): Promise<string> {
      if (socket === null) {
        throw new EngineError({ message: "baileys adapter not connected", context: { engine: "baileys" } });
      }
      return socket.getName(jid);
    },
    onEvent(handler: EventHandler): () => void {
      handlers.push(handler);
      return () => {
        handlers = handlers.filter((item) => item !== handler);
      };
    },
    async getAuthState(): Promise<unknown> {
      return {};
    },
    async setAuthState(): Promise<void> {
      return undefined;
    },
  };
}

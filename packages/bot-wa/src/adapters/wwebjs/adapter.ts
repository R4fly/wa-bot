import { randomUUID } from "node:crypto";
import { EngineError, wrapEngineError } from "../../kernel/errors/index.js";
import type {
  CapabilityFlags,
  ConnectionStatus,
  EngineAdapter,
  EventHandler,
  NormalizedEvent,
} from "../contract.js";
import { mapDisconnected, mapMessage, mapQr, mapReady } from "./mapper.js";
import type { WWebJsClientFactory, WWebJsClientLike } from "./types.js";

const WWEBJS_PACKAGE = "whatsapp-web.js";

/**
 * Capability flags for whatsapp-web.js. Pairing code and call events are not
 * exposed by this engine, so domain code must fail loud when it asks for them.
 */
const WWEBJS_CAPABILITIES: CapabilityFlags = {
  supportsPairingCode: false,
  supportsEdit: true,
  supportsReaction: true,
  supportsDelete: true,
  supportsGroupAdmin: true,
  supportsPresence: true,
  supportsCallEvents: false,
  supportsMultiDevice: true,
};

interface RawMessageRefShape {
  edit?(text: string): Promise<void>;
  react?(emoji: string): Promise<void>;
  delete?(forEveryone: boolean): Promise<void>;
  downloadMedia?(): Promise<Uint8Array | null>;
}

interface RawChatShape {
  participants?: readonly { id?: { _serialized?: string } }[];
  setSubject?(subject: string): Promise<void>;
}

interface RawClientShape {
  on(event: string, handler: (payload: unknown) => void): void;
  initialize(): Promise<void>;
  sendMessage(chatId: string, text: string): Promise<{ id?: { _serialized?: string } }>;
  getMessageById(messageId: string): Promise<RawMessageRefShape | null>;
  getChatById(chatId: string): Promise<RawChatShape | null>;
  getContactById(contactId: string): Promise<{ name?: string; pushname?: string } | null>;
  destroy(): Promise<void>;
}

function wrapRawClient(raw: RawClientShape): WWebJsClientLike {
  return {
    on(event, handler) {
      raw.on(event, handler);
    },
    async sendMessage(chatId, text) {
      return raw.sendMessage(chatId, text);
    },
    async editMessage(messageId, text) {
      const ref = await raw.getMessageById(messageId);
      if (ref === null || typeof ref.edit !== "function") {
        throw new EngineError({
          message: `message not editable: ${messageId}`,
          context: { engine: "wwebjs" },
        });
      }
      await ref.edit(text);
    },
    async reactToMessage(messageId, emoji) {
      const ref = await raw.getMessageById(messageId);
      if (ref === null || typeof ref.react !== "function") {
        throw new EngineError({
          message: `message not reactable: ${messageId}`,
          context: { engine: "wwebjs" },
        });
      }
      await ref.react(emoji);
    },
    async deleteMessage(messageId) {
      const ref = await raw.getMessageById(messageId);
      if (ref === null || typeof ref.delete !== "function") {
        throw new EngineError({
          message: `message not deletable: ${messageId}`,
          context: { engine: "wwebjs" },
        });
      }
      await ref.delete(true);
    },
    async getChatParticipants(chatId) {
      const chat = await raw.getChatById(chatId);
      if (chat === null) {
        return [];
      }
      return (chat.participants ?? [])
        .map((participant) => participant.id?._serialized ?? "")
        .filter((id) => id.length > 0);
    },
    async setChatSubject(chatId, subject) {
      const chat = await raw.getChatById(chatId);
      if (chat === null || typeof chat.setSubject !== "function") {
        throw new EngineError({
          message: `chat subject not settable: ${chatId}`,
          context: { engine: "wwebjs" },
        });
      }
      await chat.setSubject(subject);
    },
    async getContactName(contactId) {
      const contact = await raw.getContactById(contactId);
      if (contact === null) {
        return "";
      }
      return contact.name ?? contact.pushname ?? "";
    },
    async downloadMedia(messageId) {
      const ref = await raw.getMessageById(messageId);
      if (ref === null || typeof ref.downloadMedia !== "function") {
        throw new EngineError({
          message: `media not downloadable: ${messageId}`,
          context: { engine: "wwebjs" },
        });
      }
      const buffer = await ref.downloadMedia();
      if (buffer === null) {
        throw new EngineError({
          message: `media download returned nothing: ${messageId}`,
          context: { engine: "wwebjs" },
        });
      }
      return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    },
    async destroy() {
      await raw.destroy();
    },
  };
}

async function defaultClientFactory(): Promise<WWebJsClientLike> {
  let loaded: unknown;
  try {
    const specifier = WWEBJS_PACKAGE;
    loaded = await import(specifier);
  } catch (cause) {
    throw new EngineError({
      message: `engine wwebjs requires the package ${WWEBJS_PACKAGE} to be installed`,
      cause,
      context: { engine: "wwebjs", package: WWEBJS_PACKAGE },
    });
  }
  const api = loaded as { Client?: new (options: unknown) => RawClientShape };
  if (typeof api.Client !== "function") {
    throw new EngineError({
      message: `package ${WWEBJS_PACKAGE} does not export Client`,
      context: { engine: "wwebjs" },
    });
  }
  try {
    const raw = new api.Client({ puppeteer: { headless: true } });
    await raw.initialize();
    return wrapRawClient(raw);
  } catch (cause) {
    throw wrapEngineError(cause, "wwebjs client initialization failed");
  }
}

/** Options for the whatsapp-web.js adapter. clientFactory is the test seam. */
export interface WWebJsAdapterOptions {
  readonly sessionId?: string;
  readonly clientFactory?: WWebJsClientFactory;
}

/** Creates the whatsapp-web.js engine adapter. Zero business logic, contract only. */
export function createWWebJsAdapter(options: WWebJsAdapterOptions = {}): EngineAdapter {
  const sessionId = options.sessionId ?? "default";
  const factory = options.clientFactory ?? defaultClientFactory;
  let client: WWebJsClientLike | null = null;
  let status: ConnectionStatus = "disconnected";
  let handlers: EventHandler[] = [];
  const sentKeys = new Map<string, string>();

  function emit(event: NormalizedEvent): void {
    for (const handler of [...handlers]) {
      handler(event);
    }
  }

  function requireClient(): WWebJsClientLike {
    if (client === null) {
      throw new EngineError({
        message: "wwebjs adapter not connected",
        context: { engine: "wwebjs" },
      });
    }
    return client;
  }

  return {
    name: "wwebjs",
    capabilities: WWEBJS_CAPABILITIES,
    async connect(): Promise<void> {
      status = "connecting";
      try {
        const created = await factory();
        client = created;
        created.on("message", (payload) => {
          const event = mapMessage(payload, sessionId);
          if (event === null) {
            return;
          }
          if (event.messageId.length > 0) {
            sentKeys.set(event.messageId, event.chatJid);
          }
          emit(event);
        });
        created.on("qr", (payload) => {
          const event = mapQr(payload, sessionId);
          if (event !== null) {
            emit(event);
          }
        });
        created.on("ready", () => {
          status = "connected";
          emit(mapReady(sessionId));
        });
        created.on("disconnected", () => {
          status = "disconnected";
          emit(mapDisconnected(sessionId));
        });
      } catch (cause) {
        status = "disconnected";
        throw cause instanceof EngineError ? cause : wrapEngineError(cause, "wwebjs connect failed");
      }
    },
    async disconnect(): Promise<void> {
      if (client !== null) {
        await client.destroy();
      }
      client = null;
      status = "disconnected";
    },
    getConnectionStatus(): ConnectionStatus {
      return status;
    },
    async sendMessage(target: string, text: string): Promise<string> {
      const active = requireClient();
      try {
        const result = await active.sendMessage(target, text);
        const id = result.id?._serialized ?? randomUUID();
        sentKeys.set(id, target);
        return id;
      } catch (cause) {
        throw wrapEngineError(cause, "wwebjs sendMessage failed");
      }
    },
    async editMessage(messageId: string, text: string): Promise<void> {
      const active = requireClient();
      if (!sentKeys.has(messageId)) {
        throw new EngineError({
          message: `unknown message for edit: ${messageId}`,
          context: { engine: "wwebjs" },
        });
      }
      await active.editMessage(messageId, text);
    },
    async reactToMessage(messageId: string, emoji: string): Promise<void> {
      const active = requireClient();
      if (!sentKeys.has(messageId)) {
        throw new EngineError({
          message: `unknown message for reaction: ${messageId}`,
          context: { engine: "wwebjs" },
        });
      }
      await active.reactToMessage(messageId, emoji);
    },
    async deleteMessage(messageId: string): Promise<void> {
      const active = requireClient();
      if (!sentKeys.has(messageId)) {
        throw new EngineError({
          message: `unknown message for delete: ${messageId}`,
          context: { engine: "wwebjs" },
        });
      }
      await active.deleteMessage(messageId);
    },
    async groupParticipants(chatJid: string): Promise<readonly string[]> {
      return requireClient().getChatParticipants(chatJid);
    },
    async groupSetSubject(chatJid: string, subject: string): Promise<void> {
      await requireClient().setChatSubject(chatJid, subject);
    },
    async downloadMedia(messageId: string): Promise<Uint8Array> {
      return requireClient().downloadMedia(messageId);
    },
    async getProfileName(jid: string): Promise<string> {
      return requireClient().getContactName(jid);
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

import { describe, expect, it } from "vitest";
import { defineAdapterContractSuite } from "../contract-suite.js";
import type { BaileysSocketLike } from "./types.js";
import { createBaileysAdapter } from "./adapter.js";

interface MockSocket extends BaileysSocketLike {
  trigger(event: "messages.upsert" | "connection.update", payload: unknown): void;
}

function createMockSocket(): MockSocket {
  const listeners = new Map<string, Array<(payload: unknown) => void>>();
  const sent: Array<{ jid: string; content: unknown }> = [];
  const socket: MockSocket = {
    on(event, handler) {
      const existing = listeners.get(event) ?? [];
      existing.push(handler);
      listeners.set(event, existing);
      if (event === "connection.update") {
        handler({ connection: "open" });
      }
    },
    trigger(event, payload) {
      for (const handler of listeners.get(event) ?? []) {
        handler(payload);
      }
    },
    async sendMessage(jid, content) {
      sent.push({ jid, content });
      return { key: { id: `msg-${sent.length}` } };
    },
    async sendEdit() {
      return undefined;
    },
    async sendReaction() {
      return undefined;
    },
    async sendDelete() {
      return undefined;
    },
    async groupMetadata() {
      return { participants: [{ id: "p1" }, { id: "p2" }] };
    },
    async groupUpdateSubject() {
      return undefined;
    },
    async getName() {
      return "mock-name";
    },
    async downloadMedia() {
      return new Uint8Array([9, 9]);
    },
    async end() {
      return undefined;
    },
  };
  return socket;
}

defineAdapterContractSuite("baileys", () =>
  Promise.resolve(createBaileysAdapter({ socketFactory: () => Promise.resolve(createMockSocket()) })),
);

describe("baileys adapter specifics", () => {
  it("should emit normalized message events when upsert arrives", async () => {
    const mock = createMockSocket();
    const adapter = createBaileysAdapter({ socketFactory: () => Promise.resolve(mock) });
    const bodies: string[] = [];
    adapter.onEvent((event) => {
      if (event.kind === "message") {
        bodies.push(event.body);
      }
    });
    await adapter.connect();
    mock.trigger("messages.upsert", {
      messages: [{ key: { remoteJid: "a@s.whatsapp.net", id: "X" }, message: { conversation: "hi" } }],
    });
    expect(bodies).toEqual(["hi"]);
  });

  it("should report connected when the socket emits open on subscribe", async () => {
    const mock = createMockSocket();
    const adapter = createBaileysAdapter({ socketFactory: () => Promise.resolve(mock) });
    await adapter.connect();
    expect(adapter.getConnectionStatus()).toBe("connected");
  });
});

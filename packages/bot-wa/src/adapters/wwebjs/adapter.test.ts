import { describe, expect, it } from "vitest";
import { defineAdapterContractSuite } from "../contract-suite.js";
import { createWWebJsAdapter } from "./adapter.js";
import type { WWebJsClientLike } from "./types.js";

interface MockClient extends WWebJsClientLike {
  trigger(event: "message" | "qr" | "disconnected", payload: unknown): void;
}

function createMockClient(): MockClient {
  const listeners = new Map<string, Array<(payload: unknown) => void>>();
  let readyHandler: (() => void) | null = null;
  const client: MockClient = {
    on(event, handler) {
      if (event === "ready") {
        readyHandler = handler as () => void;
        readyHandler();
        return;
      }
      const existing = listeners.get(event) ?? [];
      existing.push(handler);
      listeners.set(event, existing);
    },
    trigger(event, payload) {
      for (const handler of listeners.get(event) ?? []) {
        handler(payload);
      }
    },
    async sendMessage(chatId) {
      return { id: { _serialized: `w-${chatId}` } };
    },
    async editMessage() {
      return undefined;
    },
    async reactToMessage() {
      return undefined;
    },
    async deleteMessage() {
      return undefined;
    },
    async getChatParticipants() {
      return ["p1", "p2"];
    },
    async setChatSubject() {
      return undefined;
    },
    async getContactName() {
      return "mock-contact";
    },
    async downloadMedia() {
      return new Uint8Array([7, 7]);
    },
    async destroy() {
      return undefined;
    },
  };
  return client;
}

defineAdapterContractSuite("wwebjs", () =>
  Promise.resolve(createWWebJsAdapter({ clientFactory: () => Promise.resolve(createMockClient()) })),
);

describe("wwebjs adapter specifics", () => {
  it("should report pairing code as unsupported in capability flags", () => {
    const adapter = createWWebJsAdapter({
      clientFactory: () => Promise.resolve(createMockClient()),
    });
    expect(adapter.capabilities.supportsPairingCode).toBe(false);
    expect(adapter.capabilities.supportsCallEvents).toBe(false);
  });

  it("should emit an auth pending event when a qr string arrives", async () => {
    const mock = createMockClient();
    const adapter = createWWebJsAdapter({ clientFactory: () => Promise.resolve(mock) });
    const qrs: string[] = [];
    adapter.onEvent((event) => {
      if (event.kind === "auth" && event.status === "pending" && event.qr !== undefined) {
        qrs.push(event.qr);
      }
    });
    await adapter.connect();
    mock.trigger("qr", "QRSTRING");
    expect(qrs).toEqual(["QRSTRING"]);
  });

  it("should emit a normalized message event when a message arrives", async () => {
    const mock = createMockClient();
    const adapter = createWWebJsAdapter({ clientFactory: () => Promise.resolve(mock) });
    const bodies: string[] = [];
    adapter.onEvent((event) => {
      if (event.kind === "message") {
        bodies.push(event.body);
      }
    });
    await adapter.connect();
    mock.trigger("message", {
      id: { _serialized: "M1" },
      from: "a@s.whatsapp.net",
      body: "hi",
      timestamp: 1,
    });
    expect(bodies).toEqual(["hi"]);
  });
});

import { describe, expect, it } from "vitest";
import type { CapabilityFlags, EngineAdapter, EventHandler, NormalizedMessageEvent } from "./adapters/contract.js";
import { createMemoryStorage } from "./infra/storage/memory.js";
import { createBot } from "./bot.js";

interface FakeAdapter extends EngineAdapter {
  emitMessage(body: string): void;
  sent: string[];
}

function createFakeAdapter(): FakeAdapter {
  let handlers: EventHandler[] = [];
  const sent: string[] = [];
  const capabilities: CapabilityFlags = {
    supportsPairingCode: false,
    supportsEdit: true,
    supportsReaction: true,
    supportsDelete: true,
    supportsGroupAdmin: true,
    supportsPresence: true,
    supportsCallEvents: false,
    supportsMultiDevice: true,
  };
  const adapter: FakeAdapter = {
    name: "baileys",
    capabilities,
    sent,
    connect: async () => undefined,
    disconnect: async () => undefined,
    getConnectionStatus: () => "connected",
    sendMessage: async (_target, text) => {
      sent.push(text);
      return `id-${sent.length}`;
    },
    editMessage: async () => undefined,
    reactToMessage: async () => undefined,
    deleteMessage: async () => undefined,
    groupParticipants: async () => [],
    groupSetSubject: async () => undefined,
    downloadMedia: async () => new Uint8Array([1]),
    getProfileName: async () => "n",
    onEvent(handler: EventHandler): () => void {
      handlers.push(handler);
      return () => {
        handlers = handlers.filter((item) => item !== handler);
      };
    },
    getAuthState: async () => ({}),
    setAuthState: async () => undefined,
    emitMessage(body: string): void {
      const event: NormalizedMessageEvent = {
        kind: "message",
        sessionId: "default",
        messageId: `m-${body}`,
        senderJid: "u@example",
        chatJid: "u@example",
        body,
        timestamp: 0,
        isGroup: false,
      };
      for (const handler of [...handlers]) {
        handler(event);
      }
    },
  };
  return adapter;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

describe("createBot", () => {
  it("should reply to a registered command when a message arrives", async () => {
    const adapter = createFakeAdapter();
    const bot = await createBot({}, { adapter, storage: createMemoryStorage() });
    bot.command("ping", { description: "pong back" }, async (ctx) => {
      await ctx.reply("pong");
    });
    await bot.start();
    adapter.emitMessage(".ping");
    await flush();
    expect(adapter.sent).toEqual(["pong"]);
    await bot.stop();
  });

  it("should answer the built in help command with the command list", async () => {
    const adapter = createFakeAdapter();
    const bot = await createBot({}, { adapter, storage: createMemoryStorage() });
    bot.command("ping", { description: "pong back" }, async (ctx) => {
      await ctx.reply("pong");
    });
    await bot.start();
    adapter.emitMessage(".help");
    await flush();
    expect(adapter.sent.length).toBe(1);
    expect(adapter.sent[0]).toContain(".ping");
    await bot.stop();
  });

  it("should stop the chain when a middleware calls ctx.stop", async () => {
    const adapter = createFakeAdapter();
    const bot = await createBot({}, { adapter, storage: createMemoryStorage() });
    bot.use({
      name: "blocker",
      priority: 5,
      run: async (ctx) => {
        ctx.stop();
      },
    });
    bot.command("ping", { description: "pong back" }, async (ctx) => {
      await ctx.reply("pong");
    });
    await bot.start();
    adapter.emitMessage(".ping");
    await flush();
    expect(adapter.sent).toEqual([]);
    await bot.stop();
  });
});

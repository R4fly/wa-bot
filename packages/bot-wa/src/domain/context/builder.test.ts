import { describe, expect, it } from "vitest";
import type { NormalizedMessageEvent } from "../../adapters/contract.js";
import { createContext } from "./builder.js";

function fakeMessage(): NormalizedMessageEvent {
  return {
    kind: "message",
    sessionId: "s1",
    messageId: "m1",
    senderJid: "a@example",
    chatJid: "a@example",
    body: "hello",
    timestamp: 0,
    isGroup: false,
  };
}

describe("createContext", () => {
  it("should deliver the reply through the injected sender when reply is called", async () => {
    const sent: string[] = [];
    const ctx = createContext({
      message: fakeMessage(),
      correlationId: "c1",
      sender: async (text) => {
        sent.push(text);
        return "id1";
      },
    });
    const id = await ctx.reply("pong");
    expect(sent).toEqual(["pong"]);
    expect(id).toBe("id1");
  });

  it("should report stopped as true when stop is called", () => {
    const ctx = createContext({
      message: fakeMessage(),
      correlationId: "c1",
      sender: async () => "id1",
    });
    expect(ctx.stopped).toBe(false);
    ctx.stop();
    expect(ctx.stopped).toBe(true);
  });

  it("should expose the injected initial state when created with state", () => {
    const ctx = createContext(
      { message: fakeMessage(), correlationId: "c1", sender: async () => "id1" },
      { counter: 1 },
    );
    expect(ctx.state.counter).toBe(1);
  });
});

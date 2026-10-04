import { describe, expect, it } from "vitest";
import { createContext } from "../../context/builder.js";
import type { MessageContext } from "../../context/types.js";
import type { NormalizedMessageEvent } from "../../../adapters/contract.js";
import { runPipeline } from "../pipeline.js";
import { isAdminRank, onlyAdminMiddleware } from "./only-admin.js";
import { onlyDmMiddleware } from "./only-dm.js";
import { onlyOwnerMiddleware } from "./only-owner.js";
import { permissionRank } from "./auth.js";

function ctxFor(body: string, isGroup: boolean): MessageContext {
  const event: NormalizedMessageEvent = {
    kind: "message",
    sessionId: "s",
    messageId: "m",
    senderJid: "u@example",
    chatJid: isGroup ? "g@g.us" : "u@example",
    body,
    timestamp: 0,
    isGroup,
  };
  return createContext({ message: event, correlationId: "c", sender: async () => "id" });
}

describe("only-admin middleware", () => {
  it("should stop the chain when the actor is below admin rank", async () => {
    let reached = false;
    const ctx = ctxFor("hi", true);
    await runPipeline(
      [
        onlyAdminMiddleware({ resolvePermission: () => "user" }),
        { name: "tail", priority: 90, run: async () => { reached = true; } },
      ],
      ctx,
    );
    expect(reached).toBe(false);
    expect(ctx.stopped).toBe(true);
  });

  it("should pass the chain when the actor is exactly admin", async () => {
    let reached = false;
    const ctx = ctxFor("hi", true);
    await runPipeline(
      [
        onlyAdminMiddleware({ resolvePermission: () => "admin" }),
        { name: "tail", priority: 90, run: async () => { reached = true; } },
      ],
      ctx,
    );
    expect(reached).toBe(true);
    expect(ctx.stopped).toBe(false);
  });

  it("should pass the chain when the actor is owner, which is above admin", async () => {
    let reached = false;
    const ctx = ctxFor("hi", true);
    await runPipeline(
      [
        onlyAdminMiddleware({ resolvePermission: () => "owner" }),
        { name: "tail", priority: 90, run: async () => { reached = true; } },
      ],
      ctx,
    );
    expect(reached).toBe(true);
  });

  it("should invoke the reply hook when the actor is below admin rank", async () => {
    let replied = false;
    const ctx = ctxFor("hi", true);
    await runPipeline(
      [
        onlyAdminMiddleware({
          resolvePermission: () => "guest",
          reply: async () => { replied = true; },
        }),
      ],
      ctx,
    );
    expect(replied).toBe(true);
  });

  it("should rank owner above admin above guest", () => {
    expect(isAdminRank(permissionRank("owner"))).toBe(true);
    expect(isAdminRank(permissionRank("admin"))).toBe(true);
    expect(isAdminRank(permissionRank("guest"))).toBe(false);
  });
});

describe("only-dm middleware", () => {
  it("should stop the chain when the message came from a group", async () => {
    let reached = false;
    const ctx = ctxFor("hi", true);
    await runPipeline(
      [onlyDmMiddleware(), { name: "tail", priority: 90, run: async () => { reached = true; } }],
      ctx,
    );
    expect(reached).toBe(false);
    expect(ctx.stopped).toBe(true);
  });

  it("should pass the chain when the message came from a DM", async () => {
    let reached = false;
    const ctx = ctxFor("hi", false);
    await runPipeline(
      [onlyDmMiddleware(), { name: "tail", priority: 90, run: async () => { reached = true; } }],
      ctx,
    );
    expect(reached).toBe(true);
    expect(ctx.stopped).toBe(false);
  });

  it("should invoke the reply hook when the message came from a group", async () => {
    let replied = false;
    const ctx = ctxFor("hi", true);
    await runPipeline(
      [
        onlyDmMiddleware({ reply: async () => { replied = true; } }),
        { name: "tail", priority: 90, run: async () => undefined },
      ],
      ctx,
    );
    expect(replied).toBe(true);
  });
});

describe("only-owner middleware", () => {
  it("should stop the chain when the actor is below owner rank", async () => {
    let reached = false;
    const ctx = ctxFor("hi", false);
    await runPipeline(
      [
        onlyOwnerMiddleware({ resolvePermission: () => "admin" }),
        { name: "tail", priority: 90, run: async () => { reached = true; } },
      ],
      ctx,
    );
    expect(reached).toBe(false);
    expect(ctx.stopped).toBe(true);
  });

  it("should pass the chain when the actor is owner", async () => {
    let reached = false;
    const ctx = ctxFor("hi", false);
    await runPipeline(
      [
        onlyOwnerMiddleware({ resolvePermission: () => "owner" }),
        { name: "tail", priority: 90, run: async () => { reached = true; } },
      ],
      ctx,
    );
    expect(reached).toBe(true);
    expect(ctx.stopped).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createCommandRegistry, type Middleware } from "@baehaqirafly3/bot-wa";
import {
  createFakeGroup,
  createMockSocket,
  createTestContext,
  dispatchCommand,
  expectCommandCalled,
  runMiddlewareChain,
  snapshotCtx,
} from "./index.js";

describe("bot-wa-testing helpers", () => {
  it("should record replies when the context reply method is called", async () => {
    const { ctx, sent } = createTestContext({ body: ".ping" });
    await ctx.reply("pong");
    expect(sent).toEqual(["pong"]);
  });

  it("should run middlewares in priority order when the chain is executed", async () => {
    const order: string[] = [];
    const { ctx } = createTestContext();
    const first: Middleware = {
      name: "first",
      priority: 1,
      run: async (_inner, next) => {
        order.push("first");
        await next();
      },
    };
    const second: Middleware = {
      name: "second",
      priority: 2,
      run: async (_inner, next) => {
        order.push("second");
        await next();
      },
    };
    await runMiddlewareChain([second, first], ctx);
    expect(order).toEqual(["first", "second"]);
  });

  it("should report connected status when the mock socket is connected", async () => {
    const socket = createMockSocket();
    await socket.connect();
    expect(socket.getConnectionStatus()).toBe("connected");
    const id = await socket.sendMessage("target", "hi");
    expect(id).toBe("mock-1");
  });

  it("should produce a stable snapshot when the context is serialized", () => {
    const { ctx } = createTestContext({ body: "hello" });
    const snapshot = snapshotCtx(ctx);
    expect(snapshot.correlationId).toBe("test-correlation");
    expect(snapshot.stopped).toBe(false);
  });

  it("should provide group fields when a fake group is created", () => {
    const group = createFakeGroup({ subject: "ops" });
    expect(group.chatJid).toBe("group@g.us");
    expect(group.subject).toBe("ops");
    expect(group.participants.length).toBe(1);
  });

  it("should stamp the command name when dispatchCommand runs a match", async () => {
    const registry = createCommandRegistry();
    registry.register(
      { name: "ping", description: "pong", permission: "user", cooldownMs: 0 },
      async (ctx) => {
        await ctx.reply("pong");
      },
    );
    const { ctx, sent } = createTestContext({ body: ".ping" });
    const matched = await dispatchCommand(registry, ctx);
    expect(matched).toBe(true);
    expectCommandCalled(ctx, "ping");
    expect(sent).toEqual(["pong"]);
  });

  it("should throw when expectCommandCalled sees a different command", async () => {
    const registry = createCommandRegistry();
    registry.register(
      { name: "ping", description: "pong", permission: "user", cooldownMs: 0 },
      async () => undefined,
    );
    const { ctx } = createTestContext({ body: ".ping" });
    await dispatchCommand(registry, ctx);
    expect(() => expectCommandCalled(ctx, "other")).toThrow();
  });
});

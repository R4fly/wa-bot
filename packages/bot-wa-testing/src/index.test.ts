import { describe, expect, it } from "vitest";
import type { MessageContext, Middleware, NextFn } from "@baehaqirafly3/bot-wa";
import { createMockSocket, createTestContext, runMiddlewareChain, snapshotCtx } from "./index.js";

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
      run: async (_inner: MessageContext, next: NextFn): Promise<void> => {
        order.push("first");
        await next();
      },
    };
    const second: Middleware = {
      name: "second",
      priority: 2,
      run: async (_inner: MessageContext, next: NextFn): Promise<void> => {
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
});
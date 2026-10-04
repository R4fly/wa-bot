import { describe, expect, it } from "vitest";
import { createContext } from "../context/builder.js";
import type { MessageContext } from "../context/types.js";
import type { Middleware } from "./types.js";
import { runPipeline } from "./pipeline.js";

function testContext(): MessageContext {
  return createContext({
    message: {
      kind: "message",
      sessionId: "s1",
      messageId: "m1",
      senderJid: "a@example",
      chatJid: "a@example",
      body: "",
      timestamp: 0,
      isGroup: false,
    },
    correlationId: "c1",
    sender: async () => "id1",
  });
}

function recorder(name: string, order: string[], priority: number): Middleware {
  return {
    name,
    priority,
    run: async (_ctx, next) => {
      order.push(name);
      await next();
    },
  };
}

describe("runPipeline", () => {
  it("should run middlewares in ascending priority when executed", async () => {
    const order: string[] = [];
    const ctx = testContext();
    await runPipeline([recorder("b", order, 20), recorder("a", order, 10)], ctx);
    expect(order).toEqual(["a", "b"]);
  });

  it("should stop the chain when a middleware calls ctx.stop", async () => {
    const order: string[] = [];
    const ctx = testContext();
    const stopper: Middleware = {
      name: "stopper",
      priority: 1,
      run: async (inner) => {
        order.push("stopper");
        inner.stop();
      },
    };
    await runPipeline([stopper, recorder("after", order, 2)], ctx);
    expect(order).toEqual(["stopper"]);
  });

  it("should continue with the next middleware when one throws", async () => {
    const order: string[] = [];
    const errors: unknown[] = [];
    const ctx = testContext();
    const thrower: Middleware = {
      name: "thrower",
      priority: 1,
      run: async () => {
        throw new Error("boom");
      },
    };
    await runPipeline([thrower, recorder("after", order, 2)], ctx, {
      onError: (error) => {
        errors.push(error);
      },
    });
    expect(errors.length).toBe(1);
    expect(order).toEqual(["after"]);
  });
});

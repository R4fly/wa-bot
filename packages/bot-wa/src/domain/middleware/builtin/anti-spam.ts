import { createSlidingWindowCounter } from "../../../infra/ratelimit/sliding-window.js";
import type { MessageContext } from "../../context/types.js";
import type { Middleware } from "../types.js";

/** Options for the anti spam middleware. */
export interface AntiSpamMiddlewareOptions {
  readonly windowMs: number;
  readonly max: number;
  readonly keyOf?: (ctx: MessageContext) => string;
  readonly priority?: number;
  readonly now?: () => number;
}

/** Stops duplicate or flood messages per key inside the window. */
export function antiSpamMiddleware(options: AntiSpamMiddlewareOptions): Middleware {
  const counter = createSlidingWindowCounter({
    windowMs: options.windowMs,
    max: options.max,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const keyOf =
    options.keyOf ?? ((ctx: MessageContext) => `${ctx.message.senderJid}:${ctx.message.body}`);
  return {
    name: "anti-spam",
    priority: options.priority ?? 50,
    run: async (ctx, next) => {
      const decision = counter.record(keyOf(ctx));
      if (!decision.allowed) {
        ctx.stop();
        return;
      }
      await next();
    },
  };
}

import { createTokenBucket, type TokenBucket } from "../../../infra/ratelimit/token-bucket.js";
import type { MessageContext } from "../../context/types.js";
import type { Middleware } from "../types.js";

/** Options for the rate limit middleware. */
export interface RateLimitMiddlewareOptions {
  readonly capacity: number;
  readonly refillPerMs: number;
  readonly keyOf?: (ctx: MessageContext) => string;
  readonly priority?: number;
  readonly now?: () => number;
  readonly reply?: (ctx: MessageContext, retryAfterMs: number) => Promise<void>;
}

/** Stops the chain when the per key token bucket is empty. */
export function rateLimitMiddleware(options: RateLimitMiddlewareOptions): Middleware {
  const buckets = new Map<string, TokenBucket>();
  const keyOf = options.keyOf ?? ((ctx: MessageContext) => ctx.message.senderJid);
  return {
    name: "rate-limit",
    priority: options.priority ?? 40,
    run: async (ctx, next) => {
      const key = keyOf(ctx);
      let bucket = buckets.get(key);
      if (bucket === undefined) {
        bucket = createTokenBucket({
          capacity: options.capacity,
          refillPerMs: options.refillPerMs,
          ...(options.now === undefined ? {} : { now: options.now }),
        });
        buckets.set(key, bucket);
      }
      const result = bucket.tryConsume();
      if (!result.allowed) {
        if (options.reply !== undefined) {
          await options.reply(ctx, result.retryAfterMs);
        }
        ctx.stop();
        return;
      }
      await next();
    },
  };
}

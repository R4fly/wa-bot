import type { MessageContext } from "../../context/types.js";
import type { Middleware } from "../types.js";

/** Options for the anti toxic middleware. */
export interface AntiToxicMiddlewareOptions {
  readonly patterns: readonly string[];
  readonly priority?: number;
  readonly reply?: (ctx: MessageContext) => Promise<void>;
}

/** Stops messages matching any configured pattern, case insensitive. */
export function antiToxicMiddleware(options: AntiToxicMiddlewareOptions): Middleware {
  const compiled = options.patterns.map((pattern) => new RegExp(pattern, "i"));
  return {
    name: "anti-toxic",
    priority: options.priority ?? 70,
    run: async (ctx, next) => {
      if (compiled.some((pattern) => pattern.test(ctx.message.body))) {
        if (options.reply !== undefined) {
          await options.reply(ctx);
        }
        ctx.stop();
        return;
      }
      await next();
    },
  };
}

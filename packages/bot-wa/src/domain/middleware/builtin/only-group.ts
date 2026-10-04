import type { MessageContext } from "../../context/types.js";
import type { Middleware } from "../types.js";

/** Options shared by scope guard middlewares. */
export interface ScopeGuardOptions {
  readonly priority?: number;
  readonly reply?: (ctx: MessageContext) => Promise<void>;
}

/** Stops messages that did not come from a group chat. */
export function onlyGroupMiddleware(options: ScopeGuardOptions = {}): Middleware {
  return {
    name: "only-group",
    priority: options.priority ?? 80,
    run: async (ctx, next) => {
      if (!ctx.message.isGroup) {
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

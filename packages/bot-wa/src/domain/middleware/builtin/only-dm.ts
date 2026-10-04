import type { Middleware } from "../types.js";
import type { ScopeGuardOptions } from "./only-group.js";

/** Stops messages that came from a group chat. */
export function onlyDmMiddleware(options: ScopeGuardOptions = {}): Middleware {
  return {
    name: "only-dm",
    priority: options.priority ?? 80,
    run: async (ctx, next) => {
      if (ctx.message.isGroup) {
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

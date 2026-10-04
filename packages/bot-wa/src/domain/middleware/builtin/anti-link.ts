import type { MessageContext } from "../../context/types.js";
import type { Middleware } from "../types.js";

const URL_PATTERN = /https?:\/\/([^/\s]+)/i;

/** Options for the anti link middleware. */
export interface AntiLinkMiddlewareOptions {
  readonly whitelist: readonly string[];
  readonly priority?: number;
  readonly reply?: (ctx: MessageContext) => Promise<void>;
}

/** Stops messages containing links whose host is not whitelisted. */
export function antiLinkMiddleware(options: AntiLinkMiddlewareOptions): Middleware {
  return {
    name: "anti-link",
    priority: options.priority ?? 60,
    run: async (ctx, next) => {
      const match = URL_PATTERN.exec(ctx.message.body);
      if (match !== null) {
        const host = (match[1] ?? "").toLowerCase();
        const allowed = options.whitelist.some(
          (entry) => host === entry.toLowerCase() || host.endsWith(`.${entry.toLowerCase()}`),
        );
        if (!allowed) {
          if (options.reply !== undefined) {
            await options.reply(ctx);
          }
          ctx.stop();
          return;
        }
      }
      await next();
    },
  };
}

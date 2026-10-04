import type { Logger } from "../../../infra/logger/index.js";
import type { Middleware } from "../types.js";

/** Options for the logger middleware. */
export interface LoggerMiddlewareOptions {
  readonly logger: Logger;
  readonly priority?: number;
}

/** Logs one line per handled message with its correlation id. */
export function loggerMiddleware(options: LoggerMiddlewareOptions): Middleware {
  return {
    name: "logger",
    priority: options.priority ?? 10,
    run: async (ctx, next) => {
      options.logger.info("message received", { chat: ctx.message.chatJid });
      await next();
    },
  };
}

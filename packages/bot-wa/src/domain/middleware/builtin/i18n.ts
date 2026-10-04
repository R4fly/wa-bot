import type { MessageContext } from "../../context/types.js";
import { resolveLocale, type ResolveLocaleInput } from "../../i18n/resolver.js";
import type { Middleware } from "../types.js";

/** Options for the i18n middleware. */
export interface I18nMiddlewareOptions {
  readonly supported: readonly string[];
  readonly fallback: string;
  readonly userLocaleOf?: (ctx: MessageContext) => string | undefined;
  readonly groupLocaleOf?: (ctx: MessageContext) => string | undefined;
  readonly priority?: number;
}

/** Stores the resolved locale on ctx state under the locale key. */
export function i18nMiddleware(options: I18nMiddlewareOptions): Middleware {
  return {
    name: "i18n",
    priority: options.priority ?? 20,
    run: async (ctx, next) => {
      const userLocale = options.userLocaleOf === undefined ? undefined : options.userLocaleOf(ctx);
      const groupLocale = options.groupLocaleOf === undefined ? undefined : options.groupLocaleOf(ctx);
      const input: ResolveLocaleInput = {
        fallback: options.fallback,
        supported: options.supported,
        ...(userLocale === undefined ? {} : { userLocale }),
        ...(groupLocale === undefined ? {} : { groupLocale }),
      };
      ctx.state["locale"] = resolveLocale(input);
      await next();
    },
  };
}

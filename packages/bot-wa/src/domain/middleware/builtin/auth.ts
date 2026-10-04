import { PERMISSION_LEVELS, type PermissionLevel } from "../../command/metadata.js";
import type { MessageContext } from "../../context/types.js";
import type { Middleware } from "../types.js";

/** Options for permission based middlewares. */
export interface PermissionMiddlewareOptions {
  readonly resolvePermission: (ctx: MessageContext) => PermissionLevel | Promise<PermissionLevel>;
  readonly required?: PermissionLevel;
  readonly priority?: number;
  readonly reply?: (ctx: MessageContext, reason: string) => Promise<void>;
}

/** Numeric rank of a permission level. Higher means more privilege. */
export function permissionRank(level: PermissionLevel): number {
  return PERMISSION_LEVELS.indexOf(level);
}

/** Stops the chain when the actor permission is below the required level. */
export function authMiddleware(options: PermissionMiddlewareOptions): Middleware {
  const required = options.required ?? "user";
  return {
    name: "auth",
    priority: options.priority ?? 30,
    run: async (ctx, next) => {
      const level = await options.resolvePermission(ctx);
      if (permissionRank(level) < permissionRank(required)) {
        if (options.reply !== undefined) {
          await options.reply(ctx, "insufficient permission");
        }
        ctx.stop();
        return;
      }
      await next();
    },
  };
}

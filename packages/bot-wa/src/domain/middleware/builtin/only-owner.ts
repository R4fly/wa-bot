import type { Middleware } from "../types.js";
import { authMiddleware, type PermissionMiddlewareOptions } from "./auth.js";

/** Stops messages from actors below owner rank. */
export function onlyOwnerMiddleware(options: PermissionMiddlewareOptions): Middleware {
  const inner = authMiddleware({ ...options, required: "owner", priority: options.priority ?? 80 });
  return { ...inner, name: "only-owner" };
}

import type { Middleware } from "../types.js";
import { authMiddleware, permissionRank, type PermissionMiddlewareOptions } from "./auth.js";

/** Stops messages from actors below admin rank. */
export function onlyAdminMiddleware(options: PermissionMiddlewareOptions): Middleware {
  const inner = authMiddleware({ ...options, required: "admin", priority: options.priority ?? 80 });
  return { ...inner, name: "only-admin" };
}

/** Reports whether a rank meets admin. Exported for tests and docs. */
export function isAdminRank(rank: number): boolean {
  return rank >= permissionRank("admin");
}

import type { PluginPermission } from "../manifest.js";
import type { SandboxApiName } from "./types.js";

/** All host APIs the sandbox can wire. Anything absent is unreachable. */
export const SANDBOX_APIS = [
  "send:message",
  "storage:get",
  "storage:set",
  "scheduler:add",
  "group:set-subject",
] as const;

const PERMISSION_TO_APIS: Record<PluginPermission, readonly SandboxApiName[]> = {
  "read:message": [],
  "send:message": ["send:message"],
  "access:storage": ["storage:get", "storage:set"],
  "access:network": [],
  "access:fs": [],
  "access:scheduler": ["scheduler:add"],
  "access:session": [],
  "admin:group": ["group:set-subject"],
};

/** Resolved permission set for one plugin instance. */
export interface SandboxPolicy {
  readonly allowedApis: ReadonlySet<SandboxApiName>;
  allows(api: SandboxApiName): boolean;
}

/**
 * Builds the sandbox policy from declared permissions.
 * Permissions without a wired host API grant nothing, and undeclared
 * permissions never grant anything.
 */
export function createSandboxPolicy(permissions: readonly PluginPermission[]): SandboxPolicy {
  const allowed = new Set<SandboxApiName>();
  for (const permission of permissions) {
    for (const api of PERMISSION_TO_APIS[permission]) {
      allowed.add(api);
    }
  }
  return {
    allowedApis: allowed,
    allows(api: SandboxApiName): boolean {
      return allowed.has(api);
    },
  };
}

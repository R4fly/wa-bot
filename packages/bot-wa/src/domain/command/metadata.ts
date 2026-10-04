/** Permission levels from lowest to highest. */
export const PERMISSION_LEVELS = [
  "guest",
  "user",
  "premium",
  "moderator",
  "admin",
  "owner",
] as const;

/** One permission level. */
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

/** Where a command may run. */
export type CommandScope = "global" | "group" | "dm";

/** Declarative metadata for one command. Help text is generated from it. */
export interface CommandMetadata {
  readonly name: string;
  readonly description: string;
  readonly permission: PermissionLevel;
  readonly cooldownMs: number;
  readonly aliases?: readonly string[];
  readonly scope?: CommandScope;
}

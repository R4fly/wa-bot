import type { RegisteredCommand } from "./registry.js";

/** Generates help text from command metadata, sorted by command name. */
export function generateHelp(commands: readonly RegisteredCommand[], prefixes: readonly string[]): string {
  const prefix = prefixes[0] ?? ".";
  const lines = commands.map(
    (command) => `${prefix}${command.metadata.name} [${command.metadata.permission}] ${command.metadata.description}`,
  );
  return [...lines].sort().join("\n");
}

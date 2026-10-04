import { ConfigError } from "../../kernel/errors/index.js";
import type { MessageContext } from "../context/types.js";
import type { ParsedArgs } from "./parser.js";
import type { CommandMetadata } from "./metadata.js";

/** Handler invoked when a registered command matches. */
export type CommandHandler = (ctx: MessageContext, args: ParsedArgs) => Promise<void>;

/** A command plus its metadata as stored in the registry. */
export interface RegisteredCommand {
  readonly metadata: CommandMetadata;
  readonly handler: CommandHandler;
}

/** Registry of commands with alias resolution and duplicate protection. */
export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>();
  private readonly aliasMap = new Map<string, string>();

  /** Registers a command. Duplicate names or aliases throw ConfigError. */
  register(metadata: CommandMetadata, handler: CommandHandler): void {
    if (this.commands.has(metadata.name)) {
      throw new ConfigError({
        message: `command already registered: ${metadata.name}`,
        context: { command: metadata.name },
      });
    }
    for (const alias of metadata.aliases ?? []) {
      if (this.aliasMap.has(alias) || this.commands.has(alias)) {
        throw new ConfigError({
          message: `command alias already used: ${alias}`,
          context: { command: metadata.name, alias },
        });
      }
    }
    for (const alias of metadata.aliases ?? []) {
      this.aliasMap.set(alias, metadata.name);
    }
    this.commands.set(metadata.name, { metadata, handler });
  }

  /** Returns one registered command by canonical name. */
  get(name: string): RegisteredCommand | undefined {
    return this.commands.get(name);
  }

  /** Resolves an alias or name to the canonical command name. */
  resolve(nameOrAlias: string): string | undefined {
    if (this.commands.has(nameOrAlias)) {
      return nameOrAlias;
    }
    return this.aliasMap.get(nameOrAlias);
  }

  /** Lists all registered commands in registration order. */
  list(): readonly RegisteredCommand[] {
    return [...this.commands.values()];
  }

  /** Lists canonical command names. */
  names(): readonly string[] {
    return [...this.commands.keys()];
  }

  /** Returns the alias to canonical name map. */
  aliases(): Readonly<Record<string, string>> {
    return { ...Object.fromEntries(this.aliasMap.entries()) };
  }
}

/** Creates an empty command registry. */
export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry();
}

import { randomUUID } from "node:crypto";
import type { EngineAdapter, NormalizedMessageEvent } from "./adapters/contract.js";
import { createEngineAdapter } from "./adapters/registry.js";
import { createCooldownStore } from "./domain/command/cooldown.js";
import { generateHelp } from "./domain/command/help.js";
import type { PermissionLevel } from "./domain/command/metadata.js";
import { matchCommand } from "./domain/command/matcher.js";
import { parseArgs } from "./domain/command/parser.js";
import {
  createCommandRegistry,
  type CommandHandler,
  type CommandRegistry,
} from "./domain/command/registry.js";
import { createContext } from "./domain/context/builder.js";
import type { MessageContext } from "./domain/context/types.js";
import { createEventBus, type TypedEventBus } from "./domain/event/bus.js";
import { runPipeline } from "./domain/middleware/pipeline.js";
import type { Middleware } from "./domain/middleware/types.js";
import { createLogger, type Logger } from "./infra/logger/index.js";
import type { BoundedQueue } from "./infra/queue/contract.js";
import { createMemoryQueue } from "./infra/queue/memory.js";
import type { StorageAdapter } from "./infra/storage/contract.js";
import { createFileStorage } from "./infra/storage/file.js";
import { createMemoryStorage } from "./infra/storage/memory.js";
import { loadConfig, type ConfigSources } from "./kernel/config/loader.js";
import type { BotConfig } from "./kernel/config/schema.js";
import { createContainer } from "./kernel/container.js";
import { ConfigError } from "./kernel/errors/index.js";
import { createLifecycle, createSystemClock, type Lifecycle } from "./kernel/lifecycle.js";
import type { AuditSink, Clock } from "./types/internal.js";

const DEFAULT_PREFIXES = [".", "!", "/"] as const;

/** Hooks around command execution. */
export interface CommandHooks {
  before?(ctx: MessageContext, name: string): Promise<void> | void;
  after?(ctx: MessageContext, name: string): Promise<void> | void;
  onError?(ctx: MessageContext, name: string, error: unknown): Promise<void> | void;
  onCooldown?(ctx: MessageContext, name: string, retryAfterMs: number): Promise<void> | void;
}

/** Overrides for tests and embedding. Injected adapters skip engine imports. */
export interface BotOverrides {
  adapter?: EngineAdapter;
  storage?: StorageAdapter;
  audit?: AuditSink;
  hooks?: CommandHooks;
}

/** Options for registering one command. */
export interface BotCommandOptions {
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly permission?: PermissionLevel;
  readonly cooldownMs?: number;
}

/** The application facade. No I/O happens before start is called. */
export interface Bot {
  command(name: string, options: BotCommandOptions, handler: CommandHandler): void;
  use(middleware: Middleware): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly logger: Logger;
  readonly events: TypedEventBus;
  readonly commands: CommandRegistry;
}

function openStorage(config: BotConfig): StorageAdapter {
  if (config.session.storage === "memory") {
    return createMemoryStorage();
  }
  if (config.session.storage === "file") {
    return createFileStorage(config.session.storagePath);
  }
  throw new ConfigError({
    message: `storage ${config.session.storage} requires a peer dependency that is not installed yet`,
    context: { storage: config.session.storage },
  });
}

/** Narrows a config value loaded inside a closure. Keeps flow analysis honest. */
function requireConfig(value: BotConfig | null): BotConfig {
  if (value === null) {
    throw new ConfigError({ message: "config load produced no value", context: {} });
  }
  return value;
}

/** Creates a bot facade. Nothing connects until start is called. */
export async function createBot(sources: ConfigSources = {}, overrides: BotOverrides = {}): Promise<Bot> {
  const clock: Clock = createSystemClock();
  const events = createEventBus();
  const commands = createCommandRegistry();
  const middlewares: Middleware[] = [];
  const cooldowns = createCooldownStore();
  const hooks: CommandHooks = overrides.hooks ?? {};
  let logger: Logger = createLogger({ level: "info", format: "pretty", module: "bot" });
  let lifecycle: Lifecycle | null = null;
  let adapter: EngineAdapter | null = null;
  let queue: BoundedQueue<NormalizedMessageEvent> | null = null;

  commands.register(
    { name: "help", description: "List available commands", permission: "guest", cooldownMs: 0 },
    async (ctx: MessageContext) => {
      await ctx.reply(generateHelp(commands.list(), [...DEFAULT_PREFIXES]));
    },
  );

  async function handleMessage(event: NormalizedMessageEvent): Promise<void> {
    const activeAdapter = adapter;
    if (activeAdapter === null) {
      return;
    }
    const correlationId = randomUUID();
    const ctx = createContext({
      message: event,
      correlationId,
      sender: (text: string) => activeAdapter.sendMessage(event.chatJid, text),
    });
    await runPipeline(middlewares, ctx, {
      onError: (error) => {
        logger.error("middleware failed", { error: error instanceof Error ? error.message : "unknown" });
      },
    });
    if (ctx.stopped) {
      return;
    }
    const match = matchCommand(ctx.message.body, [...DEFAULT_PREFIXES], commands.names(), commands.aliases());
    if (match === null) {
      return;
    }
    const registered = commands.get(match.name);
    if (registered === undefined) {
      return;
    }
    const decision = cooldowns.check(`${match.name}:${event.senderJid}`, registered.metadata.cooldownMs);
    if (!decision.allowed) {
      if (hooks.onCooldown !== undefined) {
        await hooks.onCooldown(ctx, match.name, decision.retryAfterMs);
      }
      return;
    }
    const args = parseArgs(match.argsRaw);
    try {
      if (hooks.before !== undefined) {
        await hooks.before(ctx, match.name);
      }
      await registered.handler(ctx, args);
      if (hooks.after !== undefined) {
        await hooks.after(ctx, match.name);
      }
    } catch (error) {
      if (hooks.onError !== undefined) {
        await hooks.onError(ctx, match.name, error);
      }
      logger.error("command failed", { command: match.name });
    }
  }

  return {
    command(name: string, options: BotCommandOptions, handler: CommandHandler): void {
      commands.register(
        {
          name,
          description: options.description,
          permission: options.permission ?? "user",
          cooldownMs: options.cooldownMs ?? 0,
          ...(options.aliases === undefined ? {} : { aliases: options.aliases }),
        },
        handler,
      );
    },
    use(middleware: Middleware): void {
      middlewares.push(middleware);
    },
    async start(): Promise<void> {
      const audit: AuditSink = overrides.audit ?? { write: () => undefined };
      const lc = createLifecycle({ clock, audit });
      lifecycle = lc;
      let loadedConfig: BotConfig | null = null;
      await lc.runTransition("config_loading", async () => {
        loadedConfig = await loadConfig(sources);
      });
      const config = requireConfig(loadedConfig);
      await lc.runTransition("config_ready", async () => {
        return undefined;
      });
      await lc.runTransition("container_building", async () => {
        const container = createContainer();
        container.register("config", () => config);
        container.register("logger", () =>
          createLogger({ level: config.logger.level, format: config.logger.format, module: "bot" }),
        );
        logger = container.resolve<Logger>("logger");
        return undefined;
      });
      await lc.runTransition("container_ready", async () => {
        return undefined;
      });
      await lc.runTransition("storage_connecting", async () => {
        const storage = overrides.storage ?? openStorage(config);
        await storage.connect();
        return undefined;
      });
      await lc.runTransition("storage_ready", async () => {
        return undefined;
      });
      await lc.runTransition("logger_ready", async () => {
        return undefined;
      });
      await lc.runTransition("plugin_discovering", async () => {
        return undefined;
      });
      await lc.runTransition("plugin_verifying", async () => {
        return undefined;
      });
      await lc.runTransition("plugin_loading", async () => {
        return undefined;
      });
      await lc.runTransition("plugin_ready", async () => {
        return undefined;
      });
      await lc.runTransition("engine_initializing", async () => {
        adapter =
          overrides.adapter ??
          createEngineAdapter({ engine: config.engine.name, sessionId: config.session.name });
        return undefined;
      });
      await lc.runTransition("engine_connecting", async () => {
        if (adapter !== null) {
          await adapter.connect();
        }
        return undefined;
      });
      await lc.runTransition("auth_pending", async () => {
        return undefined;
      });
      await lc.runTransition("auth_ready", async () => {
        return undefined;
      });
      await lc.runTransition("session_ready", async () => {
        const activeAdapter = adapter;
        if (activeAdapter === null) {
          return undefined;
        }
        activeAdapter.onEvent((event) => {
          if (event.kind === "message") {
            events.emit("message", event);
          } else if (event.kind === "connection") {
            events.emit("connection", event);
          } else {
            events.emit("auth", event);
          }
        });
        queue = createMemoryQueue<NormalizedMessageEvent>({
          maxLen: config.queue.maxLen,
          concurrency: config.queue.concurrency,
          clock,
        });
        events.on("message", (message) => {
          if (queue !== null) {
            queue.enqueue(message);
          }
        });
        queue.start((job) => handleMessage(job.payload));
        return undefined;
      });
      await lc.runTransition("running", async () => {
        return undefined;
      });
    },
    async stop(): Promise<void> {
      const lc = lifecycle;
      if (lc === null) {
        return;
      }
      await lc.runTransition("draining");
      if (queue !== null) {
        queue.stop();
      }
      if (adapter !== null) {
        await adapter.disconnect();
      }
      await lc.runTransition("stopped");
    },
    get logger(): Logger {
      return logger;
    },
    events,
    commands,
  };
}

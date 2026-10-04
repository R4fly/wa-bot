/**
 * Public API of @baehaqirafly3/bot-wa.
 * Every exported symbol is documented. Adding an export is a minor change,
 * changing or removing one is a major change.
 */

export {
  BaseError,
  ConfigError,
  EngineCapabilityError,
  EngineError,
  ErrorCodes,
  LifecycleError,
  NetworkError,
  PluginError,
  RateLimitError,
  SandboxError,
  SessionError,
  StorageError,
  TimeoutError,
  wrapEngineError,
} from "./kernel/errors/index.js";
export type { BaseErrorInit, ErrorContext, ErrorCode } from "./kernel/errors/index.js";

export { DEFAULT_CONFIG, validateConfig } from "./kernel/config/schema.js";
export type {
  BotConfig,
  ConfigIssue,
  ConfigValidation,
  EngineConfig,
  EngineName,
  LogFormat,
  LoggerConfig,
  PluginConfig,
  QueueConfig,
  QueueDriver,
  SessionConfig,
  StorageName,
} from "./kernel/config/schema.js";

export { FLAT_KEYS, loadConfig } from "./kernel/config/loader.js";
export type { ConfigSources, FlatKey } from "./kernel/config/loader.js";

export { Container, createContainer } from "./kernel/container.js";
export type { Factory } from "./kernel/container.js";

export { createLifecycle, createSystemClock, Lifecycle, LIFECYCLE_STATES } from "./kernel/lifecycle.js";
export type { LifecycleDeps, LifecycleState, TransitionEvent, TransitionListener } from "./kernel/lifecycle.js";

export { createConsoleSink, createLogger, createMemorySink } from "./infra/logger/index.js";
export type { Logger, LoggerOptions, LogLevel, LogRecord, LogSink } from "./infra/logger/index.js";

export { redact } from "./infra/logger/redactor.js";

export { assertCapability } from "./adapters/capability.js";
export type {
  CapabilityFlags,
  ConnectionStatus,
  EngineAdapter,
  EventHandler,
  NormalizedAuthEvent,
  NormalizedConnectionEvent,
  NormalizedEvent,
  NormalizedMessageEvent,
} from "./adapters/contract.js";

export { createEventBus, TypedEventBus } from "./domain/event/bus.js";
export type { DomainEventName, DomainEvents, EventBusOptions, ListenerOptions } from "./domain/event/bus.js";

export { createContext } from "./domain/context/builder.js";
export type { ContextDeps } from "./domain/context/builder.js";
export type { MessageContext, ReplySender } from "./domain/context/types.js";

export { PERMISSION_LEVELS } from "./domain/command/metadata.js";
export type { CommandMetadata, CommandScope, PermissionLevel } from "./domain/command/metadata.js";

export { parseArgs } from "./domain/command/parser.js";
export type { ParsedArgs } from "./domain/command/parser.js";

export { matchCommand } from "./domain/command/matcher.js";
export type { MatchResult } from "./domain/command/matcher.js";

export { CommandRegistry, createCommandRegistry } from "./domain/command/registry.js";
export type { CommandHandler, RegisteredCommand } from "./domain/command/registry.js";

export { CooldownStore, createCooldownStore } from "./domain/command/cooldown.js";
export type { CooldownDecision } from "./domain/command/cooldown.js";

export { generateHelp } from "./domain/command/help.js";

export { runPipeline } from "./domain/middleware/pipeline.js";
export type { PipelineOptions } from "./domain/middleware/pipeline.js";
export type { Middleware, NextFn } from "./domain/middleware/types.js";

export type { AuditEntry, AuditSink, Clock } from "./types/internal.js";
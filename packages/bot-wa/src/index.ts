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

export { createAuditTrail } from "./infra/logger/audit.js";
export type { AuditTrail, AuditTrailOptions } from "./infra/logger/audit.js";

export { createMemoryStorage } from "./infra/storage/memory.js";
export { createFileStorage } from "./infra/storage/file.js";
export type { StorageAdapter, StorageSetOptions } from "./infra/storage/contract.js";

export { createTokenBucket, TokenBucket } from "./infra/ratelimit/token-bucket.js";
export type { ConsumeResult, TokenBucketOptions } from "./infra/ratelimit/token-bucket.js";
export { createSlidingWindowCounter, SlidingWindowCounter } from "./infra/ratelimit/sliding-window.js";
export type { SlidingWindowOptions, WindowDecision } from "./infra/ratelimit/sliding-window.js";

export { createMemoryQueue } from "./infra/queue/memory.js";
export type { MemoryQueueOptions } from "./infra/queue/memory.js";
export type { BoundedQueue, EnqueueOptions, QueueJob } from "./infra/queue/contract.js";

export { randomHex, randomId } from "./security/csprng.js";
export { keyFingerprint, sha256Hex } from "./security/hash.js";
export { generateSigningKeypair, signPayload, verifySignature } from "./security/sign.js";
export type { SigningKeypair } from "./security/sign.js";
export { createTrustStore } from "./security/trust-store.js";
export type { TrustEntry, TrustStore } from "./security/trust-store.js";

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

export { createEngineAdapter } from "./adapters/registry.js";
export type { EngineAdapterOptions } from "./adapters/registry.js";

export { createBaileysAdapter } from "./adapters/baileys/adapter.js";
export type { BaileysAdapterOptions } from "./adapters/baileys/adapter.js";
export type { BaileysSocketFactory, BaileysSocketLike } from "./adapters/baileys/types.js";

export { createWWebJsAdapter } from "./adapters/wwebjs/adapter.js";
export type { WWebJsAdapterOptions } from "./adapters/wwebjs/adapter.js";
export type { WWebJsClientFactory, WWebJsClientLike, WWebJsMessageRef } from "./adapters/wwebjs/types.js";

export { createEventBus, TypedEventBus } from "./domain/event/bus.js";
export type {
  DomainEventName,
  DomainEvents,
  EventBusOptions,
  ListenerOptions,
  PluginLoadedEvent,
  PluginRejectedEvent,
  SandboxViolationEvent,
} from "./domain/event/bus.js";

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

export { PLUGIN_PERMISSIONS, validateManifest } from "./domain/plugin/manifest.js";
export type { ManifestValidation, PluginManifest, PluginPermission } from "./domain/plugin/manifest.js";
export { compareSemver, parseSemver, satisfiesSemverRange } from "./domain/plugin/semver.js";
export type { SemVer } from "./domain/plugin/semver.js";
export { verifyPlugin } from "./domain/plugin/verifier.js";
export type { PluginVerification, PluginVerificationDeps, VerificationFailureReason } from "./domain/plugin/verifier.js";
export { loadPlugin } from "./domain/plugin/loader.js";
export type { PluginLoaderDeps, SandboxOpenOptions } from "./domain/plugin/loader.js";
export { createPluginRegistry, PluginRegistry } from "./domain/plugin/registry.js";
export type { PluginHandle } from "./domain/plugin/registry.js";
export { createSandboxPolicy, SANDBOX_APIS } from "./domain/plugin/sandbox/policy.js";
export type { SandboxPolicy } from "./domain/plugin/sandbox/policy.js";
export { createSandboxHost, SandboxHost } from "./domain/plugin/sandbox/host.js";
export type { HostApiHandlers, SandboxHostDeps } from "./domain/plugin/sandbox/host.js";
export { createMemoryChannelPair } from "./domain/plugin/sandbox/channel.js";
export type { MemoryChannelPair, SandboxChannel } from "./domain/plugin/sandbox/channel.js";
export { runWorkerRuntime } from "./domain/plugin/sandbox/worker-runtime.js";
export type { WorkerRuntimeDeps } from "./domain/plugin/sandbox/worker-runtime.js";
export { resolveWorkerEntryPath, spawnSandboxWorker } from "./domain/plugin/sandbox/process-transport.js";
export type { ProcessTransportDeps, ProcessTransportResult } from "./domain/plugin/sandbox/process-transport.js";
export type {
  ApiCallFrame,
  ApiResultFrame,
  HandlerResultFrame,
  InvokeHandlerFrame,
  PluginApi,
  PluginHandlerName,
  PluginMessageView,
  PluginModule,
  SandboxApiName,
  ViolationFrame,
} from "./domain/plugin/sandbox/types.js";

export { createAuthStateStore } from "./session/auth-state.js";
export type { AuthStateStore } from "./session/auth-state.js";
export { createBackoff } from "./session/backoff.js";
export type { Backoff, BackoffOptions } from "./session/backoff.js";
export { qrBase64, qrRaw } from "./session/qr.js";
export { createSessionManager, SessionManager } from "./session/manager.js";
export type { SessionInfo, SessionManagerDeps, SessionStatus } from "./session/manager.js";

export { interpolate } from "./domain/i18n/interpolate.js";
export { createCatalog, translate } from "./domain/i18n/catalog.js";
export type { Catalog } from "./domain/i18n/catalog.js";
export { resolveLocale, selectPlural } from "./domain/i18n/resolver.js";
export type { ResolveLocaleInput } from "./domain/i18n/resolver.js";

export { loggerMiddleware } from "./domain/middleware/builtin/logger.js";
export type { LoggerMiddlewareOptions } from "./domain/middleware/builtin/logger.js";
export { i18nMiddleware } from "./domain/middleware/builtin/i18n.js";
export type { I18nMiddlewareOptions } from "./domain/middleware/builtin/i18n.js";
export { authMiddleware, permissionRank } from "./domain/middleware/builtin/auth.js";
export type { PermissionMiddlewareOptions } from "./domain/middleware/builtin/auth.js";
export { rateLimitMiddleware } from "./domain/middleware/builtin/rate-limit.js";
export type { RateLimitMiddlewareOptions } from "./domain/middleware/builtin/rate-limit.js";
export { antiSpamMiddleware } from "./domain/middleware/builtin/anti-spam.js";
export type { AntiSpamMiddlewareOptions } from "./domain/middleware/builtin/anti-spam.js";
export { antiLinkMiddleware } from "./domain/middleware/builtin/anti-link.js";
export type { AntiLinkMiddlewareOptions } from "./domain/middleware/builtin/anti-link.js";
export { antiToxicMiddleware } from "./domain/middleware/builtin/anti-toxic.js";
export type { AntiToxicMiddlewareOptions } from "./domain/middleware/builtin/anti-toxic.js";
export { onlyGroupMiddleware } from "./domain/middleware/builtin/only-group.js";
export type { ScopeGuardOptions } from "./domain/middleware/builtin/only-group.js";
export { onlyDmMiddleware } from "./domain/middleware/builtin/only-dm.js";
export { onlyAdminMiddleware } from "./domain/middleware/builtin/only-admin.js";
export { onlyOwnerMiddleware } from "./domain/middleware/builtin/only-owner.js";

export { createMessageView } from "./domain/message/normalizer.js";
export type { MessageView } from "./domain/message/normalizer.js";
export { checkMedia, detectMediaType } from "./domain/message/media.js";
export type { MediaDecision, MediaMeta, MediaPolicy, MediaType } from "./domain/message/media.js";

export { requestPairingCode } from "./session/pairing.js";
export { createHealthMonitor } from "./session/health.js";
export type { HealthMonitor, HealthMonitorDeps } from "./session/health.js";
export { backupSession, migrateSession, restoreSession } from "./session/backup.js";
export type { MigrationResult, SessionSnapshot } from "./session/backup.js";

export { cronMatches, parseCron } from "./domain/scheduler/cron.js";
export type { CronFields } from "./domain/scheduler/cron.js";
export { createScheduler, Scheduler } from "./domain/scheduler/scheduler.js";
export type { SchedulerDeps, SchedulerJobKind, SchedulerJobSpec } from "./domain/scheduler/scheduler.js";

export { createMemoryMetrics, createNoopMetrics } from "./observability/metrics.js";
export type { MetricPoint, MetricsSink } from "./observability/metrics.js";
export { createMemoryTracer, createNoopTracer } from "./observability/tracer.js";
export type { FinishedSpan, Span, TraceSink } from "./observability/tracer.js";

export { createBot } from "./bot.js";
export type { Bot, BotCommandOptions, BotOverrides, CommandHooks } from "./bot.js";

export type { AuditEntry, AuditSink, Clock } from "./types/internal.js";

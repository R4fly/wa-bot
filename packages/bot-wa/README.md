# @baehaqirafly3/bot-wa

TypeScript library for building WhatsApp bots. One API operating over two engines: [Baileys](https://github.com/WhiskeySockets/Baileys) and [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

> **Status: pre-release, published on the `next` channel.** API names and module layout are considered stable from v0.3.0 onward, but breaking changes are still permitted before v1.0.0. Pin the exact installed version in production until the stable release.
>
> **Engine disclaimer:** Both supported engines are unofficial WhatsApp clients. WhatsApp may restrict or ban accounts that use unofficial clients. Use a dedicated phone number for your bot, never your personal or primary business number. This library cannot remove that risk.

---

## Why this library exists

Developers building WhatsApp bots with Baileys or whatsapp-web.js repeatedly rewrite the same infrastructure: a command parser, a middleware pipeline, permission checks, session persistence, reconnection logic, rate limiting, and log redaction. The two engines also expose different types and events, so application code becomes bound to a specific engine. When the upstream engine breaks or changes its API, the bot breaks with it.

`@baehaqirafly3/bot-wa` places both engines behind a single adapter contract, adds a typed domain layer for commands and middleware, and enables security primitives (audit log, secret redaction, signed plugin sandbox) by default rather than as optional features. The same application code runs unchanged against either engine by flipping one config value.

## Install

```sh
npm i @baehaqirafly3/bot-wa
```

To install from the pre-release channel explicitly:

```sh
npm i @baehaqirafly3/bot-wa@next
```

Companion packages:

| Package | Purpose |
| --- | --- |
| `@baehaqirafly3/bot-wa-cli` | Command-line tool (`bot-wa`) for sessions, plugins, config checks, and migrations. |
| `@baehaqirafly3/create-bot-wa` | Project generator with six starter templates. |
| `@baehaqirafly3/bot-wa-testing` | Test helpers for commands, middleware, and context, compatible with Vitest. |

## Quick start

```ts
import { createBot } from "@baehaqirafly3/bot-wa";

const bot = await createBot({
  env: {
    BOTWA_ENGINE_NAME: "baileys",
    BOTWA_SESSION_STORAGE: "file",
  },
});

bot.command("ping", { description: "Responds with pong" }, async (ctx) => {
  await ctx.reply("pong");
});

await bot.start();
```

No network I/O happens at `import` time. The adapter only connects when `start()` is called. The same code works with `wwebjs` by changing the engine value.

## Core concepts

### Adapter contract

Every engine implements the same `EngineAdapter` interface. The contract covers five groups: lifecycle, sending, group operations, media, and contacts plus events and auth state. Domain code depends only on this interface and never on engine-specific types.

Each adapter reports capability flags at runtime:

```ts
if (!adapter.capabilities.supportsEdit) {
  throw new EngineCapabilityError({ message: "edit not supported by this engine" });
}
```

Attempting to use a capability the adapter does not support throws `EngineCapabilityError` instead of failing silently. This rule is enforced by contract tests that both adapters must pass.

### Typed context

Every message enters the system as a `MessageContext` with a typed `reply` method, typed `state`, and typed `stop()`. Middleware, commands, and handlers share the same context shape. There are no implicit `any` values on the context type.

### Middleware pipeline

Middleware is ordered by numeric priority and executed deterministically. Each middleware can call `ctx.stop()` to halt the chain, or invoke `next()` to pass to the next handler. Error in one middleware is isolated and does not affect the others, unless the error propagates through an explicit try/catch.

Built-in middleware:

- `authMiddleware` (permission guard)
- `rateLimitMiddleware` (token bucket, per key)
- `antiSpamMiddleware` (sliding window)
- `antiLinkMiddleware` (host whitelist)
- `antiToxicMiddleware` (pattern list)
- `onlyGroupMiddleware`, `onlyDmMiddleware`
- `onlyAdminMiddleware`, `onlyOwnerMiddleware`
- `i18nMiddleware` (locale resolution from user, group, fallback)
- `loggerMiddleware` (one line per handled message with correlation id)

### Command system

Commands support prefix detection, aliases, namespaces, positional arguments, flags, quoted strings, rest args, per-user and per-group cooldowns, and permission levels from `guest` to `owner`. A built-in `help` command is registered automatically and generated from command metadata.

```ts
bot.command("greet", {
  description: "Send a greeting to a named user",
  aliases: ["hello", "hi"],
  permission: "user",
  cooldownMs: 5_000,
}, async (ctx, args) => {
  const name = args.positional[0] ?? "friend";
  await ctx.reply(`Hello, ${name}.`);
});
```

## Security model

Security is active by default, not a feature you enable.

**Secret redaction.** Fields named `token`, `apiKey`, `password`, `authorization`, and similar, plus patterns matching JWTs, Bearer tokens, long hex strings, and long base64 strings, are redacted before any log sink receives the data. The redactor runs on every log call and cannot be bypassed by passing a pre-formatted string.

**Audit trail.** Session transitions, plugin installs and rejections, config changes, sensitive commands, rate limit hits, and sandbox violations are written to a separate audit sink with ISO 8601 timestamps, actor, action, target, result, correlation id, and redacted metadata. Default retention is 30 days for audit, 7 days for application logs, both configurable.

**Plugin verification.** Third-party plugins ship as a `plugin.json` manifest plus a bundled entry. Before a plugin runs, the loader performs an eight-step verification: hash check (SHA-256), signature check (Ed25519), publisher trust store check, engine version range check, and sandbox policy construction. A plugin that fails any step is rejected, the failure is written to the audit log, and a `plugin:rejected` event is emitted. No code from an unverified plugin is ever executed.

**Isolated execution.** Verified plugins run in a sandboxed worker with a configurable handler timeout (default 2 seconds) and memory limit (default 64 MB). A plugin crash does not take down the host process. The sandbox does not expose `require`, the `process` global, filesystem, or network access unless the plugin declares the corresponding permission in its manifest.

**Cryptographic primitives.** All random values come from `crypto.randomBytes` and `crypto.randomUUID`. The core avoids `eval` and `new Function` entirely.

**Supply chain.** `npm audit --audit-level=high` is required by the release gate. Every release ships a CycloneDX SBOM and npm provenance attestation.

## Engine support

| Engine | Status | Connection model | Notes |
| --- | --- | --- | --- |
| Baileys | Supported | WebSocket, no browser required | Reference implementation for the adapter contract. Lighter on memory. |
| whatsapp-web.js | Supported | Browser automation via Puppeteer | Loaded lazily only when selected. Heavier on memory due to Chromium. |

Capability differences between engines are surfaced through capability flags, never through silent fallback. Both engines are maintained by their respective upstream communities. The library pins tested versions and runs contract tests against them. When an upstream engine ships a breaking change, the adapter layer absorbs it so application code does not have to.

## Multi-session

One process can run multiple sessions, each with its own storage namespace, auth state, and lifecycle. A failure in one session does not affect the others.

```ts
const primary = await createBot({ cli: { SESSION_NAME: "primary" } });
const secondary = await createBot({ cli: { SESSION_NAME: "secondary" } });
await primary.start();
await secondary.start();
```

Storage backends:

| Backend | Use case |
| --- | --- |
| `memory` | Tests and development. Sessions are lost on restart. |
| `file` | Single instance deployments. JSON per namespace, atomic writes. |
| `sqlite` | Single host with persistent storage. Requires the optional peer `better-sqlite3`. |
| `redis` | Multi-instance deployments and cross-host job locks. Requires the optional peer `ioredis`. |

Sessions support backup, restore, and migration between storage backends. The CLI provides `bot-wa session backup`, `bot-wa session restore`, and `bot-wa migrate --dry-run` for safe transitions.

## Plugin system

Plugins extend the bot with isolated functionality. A plugin declares its required permissions in a manifest. The loader verifies the bundle hash, signature, publisher trust, and engine range before the plugin is loaded.

Permissions are granular: `read:message`, `send:message`, `access:storage`, `access:network`, `access:fs`, `access:scheduler`, `access:session`, `admin:group`. A permission that is not declared is not granted.

```json
{
  "name": "@scope/echo",
  "version": "1.0.0",
  "author": "Your name",
  "license": "MIT",
  "engines": ">=0.6.0 <1.0.0",
  "permissions": ["read:message", "send:message"],
  "entry": "dist/index.js",
  "hash": "<sha-256-of-bundle>",
  "signature": "<ed25519-signature>",
  "publisher": "<base64-public-key>"
}
```

The CLI provides `bot-wa plugin keygen`, `bot-wa plugin verify <dir>`, `bot-wa plugin trust add <publicKey>`, and `bot-wa plugin install <dir>`.

## Configuration

Configuration is validated once at load time with actionable error messages. Precedence order:

1. CLI arguments
2. Environment variables prefixed with `BOTWA_`
3. `bot-wa.config.ts` or `bot-wa.config.json` in the working directory
4. Built-in defaults

```sh
BOTWA_ENGINE_NAME=baileys
BOTWA_SESSION_STORAGE=file
BOTWA_SESSION_STORAGE_PATH=./sessions
BOTWA_LOGGER_LEVEL=info
```

Invalid config fails before any engine connection is attempted. The error message names the field, the received value, and the expected value.

## CLI

The companion package `@baehaqirafly3/bot-wa-cli` provides a `bot-wa` binary:

```sh
bot-wa version
bot-wa doctor
bot-wa config validate
bot-wa session list
bot-wa session backup <name> <path>
bot-wa session restore <name> <path>
bot-wa migrate --from file --to sqlite --dry-run
bot-wa plugin keygen
bot-wa plugin verify <dir>
bot-wa plugin trust add <publicKey>
bot-wa plugin install <dir>
bot-wa start
```

Exit codes are stable: `0` success, `1` general error, `2` bad arguments, `3` bad config, `4` runtime failure. All commands accept a `--json` flag for machine-readable output.

## Testing utilities

The `@baehaqirafly3/bot-wa-testing` package provides helpers for testing commands and middleware without a live WhatsApp connection:

- `createMockSocket` for simulating engine events
- `createFakeMessage` and `createFakeGroup`
- `createTestContext` for command handlers
- `expectCommandCalled` for asserting command dispatch
- `runMiddlewareChain` for isolated middleware testing
- `snapshotCtx` for serializing context state

Tests in this style can run in CI without any WhatsApp credentials or network access.

## Examples

Four reference implementations live in the `examples/` directory of the repository:

- `echo-bot` (minimal command-based bot)
- `group-manager-bot` (anti-link, anti-toxic, only-group middleware)
- `ai-chatbot` (integration with an LLM provider via environment variable)
- `multi-session-bot` (multiple sessions in one process)

Each example is a standalone npm package with its own `README.md` and runnable entry point.

## Release status and roadmap

Current pre-release line: 0.2.0-next.x on the `next` channel. It already contains the full v1 feature surface listed below, because the project compressed the blueprint phases into one pre-release line while keeping every quality gate active.

| Area | Status in next channel |
| --- | --- |
| Adapter contract and Baileys adapter | Shipped |
| whatsapp-web.js adapter and capability flags | Shipped |
| Commands, middleware, context, i18n | Shipped |
| Multi-session, storage memory and file | Shipped |
| Storage sqlite and redis behind optional peers | Shipped |
| Plugin verification and sandboxed execution | Shipped |
| Audit trail, redaction, rate limits, moderation middleware | Shipped |
| CLI, generator, testing utilities | Shipped |
| Metrics and trace hooks, persistent scheduler | Shipped |

What remains before v1.0.0: API freeze review, bundle size and tree-shaking review, long-run stability soak on both engines, documentation pass, and landing page deployment. Breaking changes remain possible until v1.0.0. After v1.0.0 the project follows strict semver: breaking changes only in major releases, deprecated features preserved for at least one minor release.

## Contributing

Contributions are welcome. Please open an issue before a large change. All contributions must follow the project's layering rules, naming conventions, and code standards documented in `CLAUDE.md` and `ARCHITECTURE.md`. Security vulnerabilities should be reported through GitHub Security Advisories, not public issues.

## License

MIT. See `LICENSE`.

## Disclaimer

This library is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta. WhatsApp is a trademark of its respective owner. The supported engines are unofficial clients that interact with WhatsApp's service in ways not authorized by WhatsApp. Using them may violate WhatsApp's Terms of Service. Account restrictions, temporary bans, or permanent bans are possible consequences. The library reduces risk through rate limiting, exponential backoff with jitter, and pattern controls, but cannot guarantee any outcome. Always use a dedicated phone number for bot operations.
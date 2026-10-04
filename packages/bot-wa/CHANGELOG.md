# @baehaqirafly3/bot-wa

## 0.2.0-next.1

### Patch Changes

- Rewrite every package README with full documentation for npm and GitHub readers.

## 0.2.0-next.0

### Minor Changes

- d06d928: Add typed event bus, message context with per-plugin generic state, command parser with flags and rest args, command registry with aliases, cooldown store, help generator, middleware pipeline with deterministic priority, and the initial bot-wa-testing utilities package.
- 5b04990: Add SQLite and Redis storage adapters behind optional peers with versioned schema migrations, the create-bot-wa offline generator with six templates, terminal QR rendering in the CLI, dispatchCommand and expectCommandCalled plus createFakeGroup in the testing package, four example bots, package READMEs, SECURITY.md, SBOM generation in CI, and coverage thresholds enforced by the test:coverage script.
- e374325: Add the builtin middleware set (auth, rate limit, logger, i18n, anti spam, anti link, anti toxic, only group, only DM, only admin, only owner), the i18n core with catalog, resolver, interpolation, and pluralization, the message normalizer and media policy, session pairing, health monitor, backup, restore, and migration, the persistent cron scheduler with job locks and retry, metrics and trace hooks with noop defaults, the createBot application facade, and the new bot-wa-cli package with the full subcommand surface, exit codes, and six starter templates.
- 53cd8f9: Add the persistent audit trail with 30 day retention and prune, token bucket and sliding window rate limiters, and the bounded in-memory queue with priority, concurrency limit, retry backoff, cancel before start, and dead letter queue after five consecutive failures. Also export the sandbox process transport and flatten the worker entry output so the spawned worker path resolves inside the published package.
- 5a20c7b: Add process transport for sandbox workers: spawn Node.js as a separate process with memory limits via --max-old-space-size, optional Node Permission Model flags for Node.js 20.6.0+, AES-256-GCM session key handshake via environment variable, and stdin/stdout channel. Worker entry point reads the key and runs the worker runtime. This completes the isolation guarantee from FR-27: plugin crashes are isolated at the OS process level.
- bfd45ec: Add the sandbox runtime: AES-256-GCM session cipher with sequence bound authenticated data, permission driven policy enforcer, transport agnostic channel with an in-memory pair, worker runtime that loads a plugin module and proxies API calls, sandbox host with configurable handler timeout and violation reporting to audit and the sandbox:violation event, plus the plugin loader and registry that wire verification into sandbox opening.
- d890569: Add the plugin verification chain: manifest schema with granular permissions, SHA-256 bundle hash check, Ed25519 signature check, publisher trust store with add, revoke, and remove, and engine version range check. Every failed check writes an audit entry and emits plugin:rejected without running the plugin.
- 453d0d2: Add storage contract with memory and file adapters, session manager with reconnect backoff and kill switch, auth state store, QR raw and base64 helpers, and the Baileys adapter behind a narrow structural port with an injectable socket factory.
- 6b97c84: Add the whatsapp-web.js adapter behind a narrow structural port with lazy package import, an engine adapter registry that selects the adapter from config without loading the other engine, and real capability flag differentiation where pairing code and call events are unsupported on whatsapp-web.js.

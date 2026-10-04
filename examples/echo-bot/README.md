# example-echo-bot

Minimal command bot. Demonstrates `createBot`, command registration, and `ctx.reply`.

## Run

From the repository root:

```sh
npm ci
cd examples/echo-bot
npm start
```

`npm start` uses Node native type stripping and needs Node 22.6 or newer. On Node 20, build first with `npx tsc -p tsconfig.json` and run `node dist/index.js`.

## Configure

Set `BOTWA_` variables or drop a `bot-wa.config.ts` next to the example. See the core README configuration section for the full key list. First run prints a QR or pairing code path depending on the engine.

## What to look at

`src/index.ts` is the entire bot. Twelve lines, one command, no middleware.
```

## examples/group-manager-bot/README.md

```markdown
# example-group-manager-bot

Group moderation skeleton. Demonstrates scope guards and moderation middleware composed in priority order.

## Run

```sh
npm ci
cd examples/group-manager-bot
npm start
```

Node 22.6 or newer for native type stripping, otherwise build with `npx tsc -p tsconfig.json` first.

## What it demonstrates

- `onlyGroupMiddleware` stops every DM before any handler runs.
- `antiLinkMiddleware` with a host whitelist, here allowing `github.com` and its subdomains.
- A command guarded by `permission: "admin"`, resolved through the auth middleware contract.

## Extend

Add hosts to the whitelist array, add patterns through `antiToxicMiddleware`, or replace the placeholder subject command with a real `groupSetSubject` call through the adapter.
```

## examples/ai-chatbot/README.md

```markdown
# example-ai-chatbot

Command skeleton wired to an LLM provider URL from the environment. Demonstrates env-driven configuration without hardcoding secrets.

## Run

```sh
npm ci
cd examples/ai-chatbot
npm start
```

Node 22.6 or newer for native type stripping, otherwise build with `npx tsc -p tsconfig.json` first.

## Configure

```sh
LLM_PROVIDER_URL=https://your-provider.example/v1
```

The example does not call the provider. It validates that the variable is present and shows where your fetch logic belongs, so the example stays network-free and safe to run in CI.

## What to look at

`src/index.ts` reads the provider URL once at startup and fails fast with a user-facing reply when it is missing, instead of throwing mid-handler.
```

## examples/multi-session-bot/README.md

```markdown
# example-multi-session-bot

Two independent sessions in one process. Demonstrates per-session config injection and isolated lifecycles.

## Run

```sh
npm ci
cd examples/multi-session-bot
npm start
```

Node 22.6 or newer for native type stripping, otherwise build with `npx tsc -p tsconfig.json` first.

## What it demonstrates

- `createBot({ cli: { SESSION_NAME: "one" } })` overrides the session name per instance.
- Each session keeps its own auth state, storage namespace, and lifecycle. A crash or logout in one does not affect the other.
- The same command name registered on both sessions resolves independently per session.

## Note for real runs

Each session needs its own phone number and its own first-time authentication. Never point two sessions at the same number.
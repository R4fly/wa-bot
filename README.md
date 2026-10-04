# bot-wa

TypeScript library, CLI, and starter templates for building WhatsApp bots. One API over two engines: Baileys and whatsapp-web.js.

> **Pre-release.** Published on the npm `next` channel under scope `@baehaqirafly3`. Breaking changes are possible until v1.0.0. Pin exact versions.
>
> **Unofficial engines.** Both engines are unofficial WhatsApp clients. WhatsApp may restrict or ban accounts that use them. Use a dedicated number.

## Packages

| Package | npm | Purpose |
| --- | --- | --- |
| bot-wa | [@baehaqirafly3/bot-wa](https://www.npmjs.com/package/@baehaqirafly3/bot-wa) | Core library: adapters, domain, security, sessions |
| bot-wa-cli | [@baehaqirafly3/bot-wa-cli](https://www.npmjs.com/package/@baehaqirafly3/bot-wa-cli) | `bot-wa` binary for sessions, plugins, migrations |
| create-bot-wa | [@baehaqirafly3/create-bot-wa](https://www.npmjs.com/package/@baehaqirafly3/create-bot-wa) | Offline project generator, six templates |
| bot-wa-testing | [@baehaqirafly3/bot-wa-testing](https://www.npmjs.com/package/@baehaqirafly3/bot-wa-testing) | Vitest-compatible test helpers |
| bot-wa-shared | internal | Shared types, not a public API |

Each package folder contains its own detailed README. Start with [packages/bot-wa/README.md](packages/bot-wa/README.md).

## Quick start

```sh
npm i @baehaqirafly3/bot-wa@next
```

```ts
import { createBot } from "@baehaqirafly3/bot-wa";

const bot = await createBot();
bot.command("ping", { description: "Responds with pong" }, async (ctx) => {
  await ctx.reply("pong");
});
await bot.start();
```

New project in under ten minutes:

```sh
npm create @baehaqirafly3/bot-wa@next
```

## Repository layout

```
packages/bot-wa          core library
packages/bot-wa-cli      CLI binary bot-wa
packages/create-bot-wa   project generator
packages/bot-wa-testing  test helpers
packages/shared          internal shared types
examples/                four reference bots, each with its own README
landing/                 static landing page, zero runtime dependency
docs/                    canonical documents: BLUEPRINT, PRD, ARCHITECTURE, PRODUCTION, DESIGN
.github/workflows/       CI with SBOM generation and provenance publish
```

## Quality gates

Every commit must pass, enforced locally and in CI:

```sh
npm run lint --workspaces --if-present
npm run typecheck --workspaces --if-present
npm run test --workspaces --if-present
npm run build --workspaces --if-present
npm audit --audit-level=high
```

Additional standing gates: coverage at least 85 percent on domain code and 70 percent overall, contract tests identical for both adapters, zero implicit `any`, and bundle growth capped at 10 percent per release unless a written reason is recorded.

## Release flow

Changesets with three channels: `latest`, `next`, `canary`. Publish runs only from GitHub Actions on `main`, with npm provenance and a CycloneDX SBOM attached to each release. Actions are pinned to commit SHAs. See [docs/PRODUCTION.md](docs/PRODUCTION.md) for the operator runbook.

## Contributing

Open an issue before a large change. Layering rules, naming conventions, and code standards live in [CLAUDE.md](CLAUDE.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Report security problems privately through GitHub Security Advisories, see [SECURITY.md](SECURITY.md).

## License

MIT.

## Disclaimer

Not affiliated with, endorsed by, or sponsored by WhatsApp or Meta. WhatsApp is a trademark of its respective owner.
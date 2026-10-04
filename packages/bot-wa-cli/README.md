# @baehaqirafly3/bot-wa-cli

Command line companion for [@baehaqirafly3/bot-wa](https://www.npmjs.com/package/@baehaqirafly3/bot-wa). One binary, `bot-wa`, covering session lifecycle, plugin trust and verification, config validation, storage migration, project scaffolding, and bot startup.

> **Status: pre-release on the `next` channel.** Pin the exact installed version until v1.0.0.

## Install

Global, for daily operator use:

```sh
npm i -g @baehaqirafly3/bot-wa-cli
```

Local, as a project dev dependency:

```sh
npm i -D @baehaqirafly3/bot-wa-cli
npx bot-wa doctor
```

## Global behavior

- Every command accepts `--json` for machine-readable single-line JSON output. Without it, output is human-readable text.
- The CLI never reads or writes WhatsApp credentials itself. Session auth state lives in the configured storage backend.
- Secrets such as pairing codes and QR payloads are printed only when you explicitly request them, and never written to logs.

## Exit codes

Stable across versions, safe to script against:

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | General error, for example duplicate session name or failed plugin verification |
| 2 | Bad arguments, unknown command, or missing required positional |
| 3 | Bad configuration, invalid or missing config values with an actionable message |
| 4 | Runtime failure, for example no QR received within timeout or storage driver missing |

## Command reference

### Introspection

```sh
bot-wa version          # print CLI version
bot-wa doctor           # check node version, config validity, and storage connectivity
```

`doctor` prints one line per check with name, ok flag, and detail. With `--json` you get an array you can pipe into monitoring.

### Configuration

```sh
bot-wa config validate  # load and validate config, exit 3 with a field-level message on failure
bot-wa config print     # print the fully resolved config object
```

Precedence is CLI arguments, then `BOTWA_` environment variables, then `bot-wa.config.ts` or `bot-wa.config.json`, then built-in defaults.

### Sessions

```sh
bot-wa session list
bot-wa session add <name>
bot-wa session remove <name>
bot-wa session backup <name> <path>     # write a JSON snapshot of the session namespace
bot-wa session restore <name> <path>    # replace the session namespace from a snapshot
bot-wa session qr [--timeout <ms>]      # connect, wait for QR, render it in the terminal
bot-wa session pair <session> <phone>   # request an 8 digit pairing code when the engine supports it
```

Notes:

- `session qr` renders a scannable terminal QR by default. With `--json` it prints raw and base64 forms instead. Default wait is 30000 ms, override with `--timeout`.
- `session pair` throws a capability error (exit 4) on engines without pairing code support, instead of pretending success.
- The `<session>` positional of `pair` is reserved. The active session currently comes from config.

### Plugins

```sh
bot-wa plugin keygen                    # generate an Ed25519 publisher keypair, base64 DER
bot-wa plugin trust add <publicKey>     # add a publisher key to the trust store
bot-wa plugin trust remove <publicKey>  # remove a publisher key
bot-wa plugin verify <dir>              # verify manifest, hash, signature, trust, engine range
bot-wa plugin install <dir>             # verify then store the manifest and bundle hash
bot-wa plugin remove <name>
bot-wa plugin list
```

`verify` and `install` read `<dir>/plugin.json` plus the declared entry file. A failed verification prints the reason to stderr and exits 1. Nothing from an unverified plugin is ever executed.

### Storage migration

```sh
bot-wa migrate --from file --to sqlite --session main --dry-run
bot-wa migrate --from file --to redis --session main
```

`--dry-run` counts keys without writing. SQLite and Redis targets require the optional peers `better-sqlite3` and `ioredis`; when missing you get exit 3 with a message naming the missing peer.

### Scaffolding and startup

```sh
bot-wa init --template minimal --dir my-bot
bot-wa start        # start the bot from config, stop gracefully on SIGINT
bot-wa dev          # same as start, alias for local development
```

Templates available in `init`: `minimal`, `command-based`, `group-manager`, `ai-chatbot`, `multi-session`, `blank-ts`. For the interactive generator experience use `npm create @baehaqirafly3/bot-wa@latest` from the companion package.

## Storage backends

| Backend | Peer dependency | Notes |
| --- | --- | --- |
| memory | none | Volatile, for tests |
| file | none | JSON per namespace, atomic writes |
| sqlite | `better-sqlite3` | Versioned schema migrations applied in one transaction |
| redis | `ioredis` | One hash per namespace, TTL enforced lazily |

## License

MIT. See `LICENSE`.

## Disclaimer

Not affiliated with, endorsed by, or sponsored by WhatsApp or Meta. The supported engines are unofficial clients. Use a dedicated phone number for bot operations.
# @baehaqirafly3/bot-wa

Headless TypeScript library for building WhatsApp bots. One API over two engines: Baileys and whatsapp-web.js.

Status: pre-release, channel `next`. Pin exact versions until 1.0.

## Install

```powershell
npm i @baehaqirafly3/bot-wa
```

## Requirements

- Node.js LTS 20 or newer
- TypeScript strict recommended

## What is in this version

- Config loader with precedence: CLI args, `BOTWA_` env, config file, defaults
- Typed error taxonomy with correlation ids
- Dependency container with lazy resolution
- Deterministic lifecycle state machine with audit entries
- Logger with six levels plus audit, secret redaction before every sink
- Engine adapter contract and capability flags

## Quick note on lifecycle

No I/O happens at import. Everything starts after you call start on a bot instance in a later version.

## Legal note

The supported engines are unofficial WhatsApp clients. WhatsApp can restrict or ban accounts that use unofficial clients. The library reduces risky send patterns with rate limits, backoff, and jitter, but it cannot remove the risk. Use a dedicated number for your bot.

## License

MIT
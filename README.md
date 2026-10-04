# baehaqirafly3-wa

Monorepo for `@baehaqirafly3/bot-wa`, a headless TypeScript library, CLI, and starter templates for building WhatsApp bots over the Baileys and whatsapp-web.js engines.

Status: pre-release, channel `next`. Source of truth for product decisions is `docs/BLUEPRINT.md`.

## Requirements

- Node.js LTS 20 or newer
- npm, PowerShell for operational commands

## Commands

```powershell
npm ci
npm run lint --workspaces --if-present
npm run typecheck --workspaces --if-present
npm run test --workspaces --if-present
npm run build --workspaces --if-present
npm audit --audit-level=high
```

## Legal note

The supported engines are unofficial WhatsApp clients. WhatsApp can restrict or ban accounts that use unofficial clients. Use a dedicated number for your bot.
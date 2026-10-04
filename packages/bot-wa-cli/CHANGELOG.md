# @baehaqirafly3/bot-wa-cli

## 1.0.0-next.3

### Patch Changes

- Fix workspace:* dependencies not being replaced with concrete versions during publish.
- Updated dependencies
  - @baehaqirafly3/bot-wa@1.0.0-next.3

## 1.0.0-next.2

### Major Changes

- order types condition first in exports map

### Patch Changes

- Updated dependencies
  - @baehaqirafly3/bot-wa@1.0.0-next.2

## 0.2.0-next.1

### Patch Changes

- Rewrite every package README with full documentation for npm and GitHub readers.
- Updated dependencies
  - @baehaqirafly3/bot-wa@0.2.0-next.1

## 0.2.0-next.0

### Minor Changes

- 5b04990: Add SQLite and Redis storage adapters behind optional peers with versioned schema migrations, the create-bot-wa offline generator with six templates, terminal QR rendering in the CLI, dispatchCommand and expectCommandCalled plus createFakeGroup in the testing package, four example bots, package READMEs, SECURITY.md, SBOM generation in CI, and coverage thresholds enforced by the test:coverage script.
- e374325: Add the builtin middleware set (auth, rate limit, logger, i18n, anti spam, anti link, anti toxic, only group, only DM, only admin, only owner), the i18n core with catalog, resolver, interpolation, and pluralization, the message normalizer and media policy, session pairing, health monitor, backup, restore, and migration, the persistent cron scheduler with job locks and retry, metrics and trace hooks with noop defaults, the createBot application facade, and the new bot-wa-cli package with the full subcommand surface, exit codes, and six starter templates.

### Patch Changes

- Updated dependencies [d06d928]
- Updated dependencies [5b04990]
- Updated dependencies [e374325]
- Updated dependencies [53cd8f9]
- Updated dependencies [5a20c7b]
- Updated dependencies [bfd45ec]
- Updated dependencies [d890569]
- Updated dependencies [453d0d2]
- Updated dependencies [6b97c84]
  - @baehaqirafly3/bot-wa@0.2.0-next.0

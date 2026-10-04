# @baehaqirafly3/bot-wa-shared

Internal package of the `baehaqirafly3-wa` monorepo. It holds shared types and small constants used across the public packages.

## Not a public API

- Do not import this package directly in applications. The core package re-exports everything that is meant for consumers.
- No stability guarantees. Exports may change in any release without a semver bump that concerns you, because the intended consumers are sibling packages in this monorepo.
- If you find a type here that you need and that the core package does not re-export, open an issue. The fix is a re-export in the core, not a new dependency on this package.

## Why it exists

Workspace packages need a place for contracts that two or more of them consume without creating circular dependencies. This package is that place and nothing more.

## License

MIT. See `LICENSE`.
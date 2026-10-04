---
"@baehaqirafly3/bot-wa": minor
---

Add the plugin verification chain: manifest schema with granular permissions, SHA-256 bundle hash check, Ed25519 signature check, publisher trust store with add, revoke, and remove, and engine version range check. Every failed check writes an audit entry and emits plugin:rejected without running the plugin.

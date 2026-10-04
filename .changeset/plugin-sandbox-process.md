---
"@baehaqirafly3/bot-wa": minor
---

Add process transport for sandbox workers: spawn Node.js as a separate process with memory limits via --max-old-space-size, optional Node Permission Model flags for Node.js 20.6.0+, AES-256-GCM session key handshake via environment variable, and stdin/stdout channel. Worker entry point reads the key and runs the worker runtime. This completes the isolation guarantee from FR-27: plugin crashes are isolated at the OS process level.

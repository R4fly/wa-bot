# @baehaqirafly3/bot-wa-testing

Testing utilities for bots built with @baehaqirafly3/bot-wa. Vitest compatible, no network calls, deterministic time and ids.

## Install

```powershell
npm i -D @baehaqirafly3/bot-wa-testing
```

## Helpers

- createMockSocket: in-memory EngineAdapter mock
- createFakeMessage, createFakeGroup: deterministic fixtures
- createTestContext: context with recorded replies
- runMiddlewareChain: run middleware without an engine
- dispatchCommand, expectCommandCalled: command dispatch assertions
- snapshotCtx: redacted context serializer

## License

MIT
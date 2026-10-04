# @baehaqirafly3/bot-wa-testing

Testing utilities for bots built with [@baehaqirafly3/bot-wa](https://www.npmjs.com/package/@baehaqirafly3/bot-wa). Designed for Vitest, usable from any runner because every helper is a pure in-memory function.

Guarantees:

- No network calls, no WhatsApp credentials, no browser process.
- Deterministic fixtures. Ids, timestamps, and JIDs are fixed unless you override them.
- No dependency on engine packages, so your test suite stays fast and installable in CI.

## Install

```sh
npm i -D @baehaqirafly3/bot-wa-testing
```

## API reference

### createMockSocket(): EngineAdapter

In-memory engine adapter mock. `connect` and `disconnect` flip the connection status, `sendMessage` records calls and returns sequential ids like `mock-1`. Use it anywhere an `EngineAdapter` is accepted, including `createBot` overrides.

### createFakeMessage(overrides?): NormalizedMessageEvent

Builds a normalized inbound message. Overrides: `body`, `senderJid`, `chatJid`, `isGroup`. Defaults are a DM from `sender@example` with an empty body.

### createFakeGroup(partial?): FakeGroup

Builds a group fixture with `chatJid` default `group@g.us`, `subject` default `test group`, and `participants` default one sender. Use it for group-scoped middleware and permission tests.

### createTestContext(overrides?): { ctx, sent }

Creates a ready `MessageContext` plus a `sent` array. Every `ctx.reply(text)` pushes into `sent` and resolves to `reply-N`. This is the fastest way to unit test a command handler.

### runMiddlewareChain(middlewares, ctx): Promise<void>

Runs a middleware pipeline against a context. Listener and middleware errors are rethrown so your assertions see them, unlike production isolation where errors are contained.

### dispatchCommand(registry, ctx, prefixes?): Promise<boolean>

Matches `ctx.message.body` against a `CommandRegistry`, stamps the matched name into `ctx.state["lastCommand"]`, and runs the handler with parsed args. Returns false when nothing matched.

### expectCommandCalled(ctx, name): void

Assertion helper. Throws a descriptive error when `ctx.state["lastCommand"]` is not the expected name.

### snapshotCtx(ctx): ContextSnapshot

Serializable, redacted snapshot of a context: correlationId, sessionId, stopped flag, and the redacted message. Suitable for `toMatchSnapshot` style tests without leaking secrets.

## Complete example

```ts
import { describe, expect, it } from "vitest";
import { createCommandRegistry } from "@baehaqirafly3/bot-wa";
import {
  createTestContext,
  dispatchCommand,
  expectCommandCalled,
  onlyGroupMiddleware,
  runMiddlewareChain,
  createFakeGroup,
} from "@baehaqirafly3/bot-wa-testing";

describe("ping command", () => {
  it("replies pong and records the dispatch", async () => {
    const registry = createCommandRegistry();
    registry.register(
      { name: "ping", description: "pong back", permission: "user", cooldownMs: 0 },
      async (ctx) => {
        await ctx.reply("pong");
      },
    );
    const { ctx, sent } = createTestContext({ body: ".ping" });
    const matched = await dispatchCommand(registry, ctx);
    expect(matched).toBe(true);
    expectCommandCalled(ctx, "ping");
    expect(sent).toEqual(["pong"]);
  });

  it("stops a DM when the group guard is active", async () => {
    const { ctx, sent } = createTestContext({ body: ".ping" });
    await runMiddlewareChain([onlyGroupMiddleware()], ctx);
    expect(ctx.stopped).toBe(true);
    expect(sent).toEqual([]);
    expect(createFakeGroup().chatJid).toBe("group@g.us");
  });
});
```

## Versioning

The helpers track the public API of the core package. Install matching minor versions of both packages. Breaking changes follow the core semver policy.

## License

MIT. See `LICENSE`.
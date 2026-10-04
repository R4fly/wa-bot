import {
  createContext,
  matchCommand,
  parseArgs,
  redact,
  runPipeline,
  type CapabilityFlags,
  type CommandRegistry,
  type EngineAdapter,
  type MessageContext,
  type Middleware,
  type NormalizedMessageEvent,
} from "@baehaqirafly3/bot-wa";

/** Overridable fields for a fake inbound message. */
export interface FakeMessageOverrides {
  readonly body?: string;
  readonly senderJid?: string;
  readonly chatJid?: string;
  readonly isGroup?: boolean;
}

/** A fake group fixture for group scoped tests. */
export interface FakeGroup {
  readonly chatJid: string;
  readonly subject: string;
  readonly participants: readonly string[];
}

/** Creates a deterministic fake inbound message with no network access. */
export function createFakeMessage(overrides: FakeMessageOverrides = {}): NormalizedMessageEvent {
  return {
    kind: "message",
    sessionId: "test-session",
    messageId: "msg-1",
    senderJid: overrides.senderJid ?? "sender@example",
    chatJid: overrides.chatJid ?? "sender@example",
    body: overrides.body ?? "",
    timestamp: 0,
    isGroup: overrides.isGroup ?? false,
  };
}

/** Creates a deterministic fake group fixture. */
export function createFakeGroup(partial: Partial<FakeGroup> = {}): FakeGroup {
  return {
    chatJid: partial.chatJid ?? "group@g.us",
    subject: partial.subject ?? "test group",
    participants: partial.participants ?? ["sender@example"],
  };
}

/** Result of creating a test context, including every reply sent through it. */
export interface TestContextResult {
  readonly ctx: MessageContext;
  readonly sent: string[];
}

/** Creates a ready to use message context whose replies are recorded in memory. */
export function createTestContext(overrides: FakeMessageOverrides = {}): TestContextResult {
  const sent: string[] = [];
  const ctx = createContext({
    message: createFakeMessage(overrides),
    correlationId: "test-correlation",
    sender: async (text: string) => {
      sent.push(text);
      return `reply-${sent.length}`;
    },
  });
  return { ctx, sent };
}

/** Runs a middleware chain against a context. Middleware errors are rethrown for assertions. */
export async function runMiddlewareChain(
  middlewares: readonly Middleware[],
  ctx: MessageContext,
): Promise<void> {
  await runPipeline(middlewares, ctx, {
    onError: (error: unknown) => {
      throw error;
    },
  });
}

/**
 * Matches the ctx body against a registry, stamps the matched command name on
 * ctx state, and runs its handler. Returns false when nothing matched.
 */
export async function dispatchCommand(
  registry: CommandRegistry,
  ctx: MessageContext,
  prefixes: readonly string[] = ["."],
): Promise<boolean> {
  const match = matchCommand(ctx.message.body, prefixes, registry.names(), registry.aliases());
  if (match === null) {
    return false;
  }
  const registered = registry.get(match.name);
  if (registered === undefined) {
    return false;
  }
  ctx.state["lastCommand"] = match.name;
  await registered.handler(ctx, parseArgs(match.argsRaw));
  return true;
}

/** Asserts that dispatchCommand stamped the expected command name on ctx state. */
export function expectCommandCalled(ctx: MessageContext, name: string): void {
  const actual = ctx.state["lastCommand"];
  if (actual !== name) {
    throw new Error(`expected command ${name} to be called, got ${String(actual)}`);
  }
}

/** Redacted, serializable snapshot of a context for snapshot testing. */
export interface ContextSnapshot {
  readonly correlationId: string;
  readonly sessionId: string;
  readonly stopped: boolean;
  readonly message: unknown;
}

/** Serializes a context with secret redaction applied. */
export function snapshotCtx(ctx: MessageContext): ContextSnapshot {
  return {
    correlationId: ctx.correlationId,
    sessionId: ctx.sessionId,
    stopped: ctx.stopped,
    message: redact(ctx.message),
  };
}

const FULL_CAPABILITIES: CapabilityFlags = {
  supportsPairingCode: true,
  supportsEdit: true,
  supportsReaction: true,
  supportsDelete: true,
  supportsGroupAdmin: true,
  supportsPresence: true,
  supportsCallEvents: true,
  supportsMultiDevice: true,
};

/** In-memory EngineAdapter mock for contract tests and integration tests. */
export function createMockSocket(): EngineAdapter {
  let connected = false;
  const sentMessages: Array<{ target: string; text: string }> = [];
  return {
    name: "baileys",
    capabilities: FULL_CAPABILITIES,
    async connect(): Promise<void> {
      connected = true;
    },
    async disconnect(): Promise<void> {
      connected = false;
    },
    getConnectionStatus() {
      return connected ? "connected" : "disconnected";
    },
    async sendMessage(target: string, text: string): Promise<string> {
      sentMessages.push({ target, text });
      return `mock-${sentMessages.length}`;
    },
    async editMessage(): Promise<void> {
      return undefined;
    },
    async reactToMessage(): Promise<void> {
      return undefined;
    },
    async deleteMessage(): Promise<void> {
      return undefined;
    },
    async groupParticipants(): Promise<readonly string[]> {
      return [];
    },
    async groupSetSubject(): Promise<void> {
      return undefined;
    },
    async downloadMedia(): Promise<Uint8Array> {
      return new Uint8Array([1, 2, 3]);
    },
    async getProfileName(): Promise<string> {
      return "mock-profile";
    },
    onEvent(): () => void {
      return () => undefined;
    },
    async getAuthState(): Promise<unknown> {
      return {};
    },
    async setAuthState(): Promise<void> {
      return undefined;
    },
  };
}

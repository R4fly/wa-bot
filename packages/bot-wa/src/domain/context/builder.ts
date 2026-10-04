import type { NormalizedMessageEvent } from "../../adapters/contract.js";
import type { MessageContext, ReplySender } from "./types.js";

/** Dependencies required to build one message context. */
export interface ContextDeps {
  readonly message: NormalizedMessageEvent;
  readonly correlationId: string;
  readonly sender: ReplySender;
}

/** Builds a message context. No I/O happens here; the sender is injected. */
export function createContext<TState extends Record<string, unknown> = Record<string, unknown>>(
  deps: ContextDeps,
  initialState: TState = {} as TState,
): MessageContext<TState> {
  let stopped = false;
  return {
    message: deps.message,
    correlationId: deps.correlationId,
    sessionId: deps.message.sessionId,
    state: initialState,
    get stopped(): boolean {
      return stopped;
    },
    reply(text: string): Promise<string> {
      return deps.sender(text);
    },
    stop(): void {
      stopped = true;
    },
  };
}

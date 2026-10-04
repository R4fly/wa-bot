import type { NormalizedMessageEvent } from "../../adapters/contract.js";

/** Function that delivers a reply through the selected engine adapter. */
export type ReplySender = (text: string) => Promise<string>;

/**
 * Message context passed to commands and middleware.
 * State is generic per plugin so plugin code stays typed without any.
 */
export interface MessageContext<TState extends Record<string, unknown> = Record<string, unknown>> {
  readonly message: NormalizedMessageEvent;
  readonly correlationId: string;
  readonly sessionId: string;
  readonly state: TState;
  readonly stopped: boolean;
  reply(text: string): Promise<string>;
  stop(): void;
}

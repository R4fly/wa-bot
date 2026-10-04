import type { MessageContext } from "../context/types.js";

/** Continuation function passed to a middleware. */
export type NextFn = () => Promise<void>;

/** One middleware unit with deterministic numeric priority. Lower runs first. */
export interface Middleware {
  readonly name: string;
  readonly priority: number;
  run(ctx: MessageContext, next: NextFn): Promise<void>;
}

import type { MessageContext } from "../context/types.js";
import type { Middleware } from "./types.js";

/** Options for pipeline execution. onError receives isolated middleware failures. */
export interface PipelineOptions {
  readonly onError?: (error: unknown, middlewareName: string) => void;
}

/**
 * Runs middlewares in ascending priority order.
 * ctx.stop() short circuits the chain. A throwing middleware is isolated
 * and the chain continues with the next middleware.
 */
export async function runPipeline(
  middlewares: readonly Middleware[],
  ctx: MessageContext,
  options: PipelineOptions = {},
): Promise<void> {
  const sorted = [...middlewares].sort((a, b) => a.priority - b.priority);
  let index = 0;
  const dispatch = async (): Promise<void> => {
    if (ctx.stopped) {
      return;
    }
    const current = sorted[index];
    if (current === undefined) {
      return;
    }
    index += 1;
    try {
      await current.run(ctx, dispatch);
    } catch (error) {
      if (options.onError !== undefined) {
        options.onError(error, current.name);
      }
      await dispatch();
    }
  };
  await dispatch();
}

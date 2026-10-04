import { ConfigError } from "../kernel/errors/index.js";
import { createBaileysAdapter } from "./baileys/adapter.js";
import { createWWebJsAdapter } from "./wwebjs/adapter.js";
import type { EngineName } from "../kernel/config/schema.js";
import type { EngineAdapter } from "./contract.js";

/** Options for the engine adapter registry. */
export interface EngineAdapterOptions {
  readonly engine: EngineName;
  readonly sessionId?: string;
}

/**
 * Creates the adapter for the selected engine. Each engine package is imported
 * lazily inside the adapter connect path, never when the registry is called,
 * so selecting an engine never loads the other engine.
 */
export function createEngineAdapter(options: EngineAdapterOptions): EngineAdapter {
  const adapterOptions =
    options.sessionId === undefined ? {} : { sessionId: options.sessionId };
  if (options.engine === "baileys") {
    return createBaileysAdapter(adapterOptions);
  }
  if (options.engine === "wwebjs") {
    return createWWebJsAdapter(adapterOptions);
  }
  throw new ConfigError({
    message: `unsupported engine: ${String(options.engine)}`,
    context: { engine: String(options.engine) },
  });
}

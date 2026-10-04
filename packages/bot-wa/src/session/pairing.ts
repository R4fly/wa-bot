import type { EngineAdapter } from "../adapters/contract.js";
import { EngineCapabilityError } from "../kernel/errors/index.js";

/** Requests an 8 digit pairing code when the engine supports it. */
export async function requestPairingCode(adapter: EngineAdapter, phone: string): Promise<string> {
  if (!adapter.capabilities.supportsPairingCode || adapter.requestPairingCode === undefined) {
    throw new EngineCapabilityError({
      message: `engine ${adapter.name} does not support pairing code`,
      context: { engine: adapter.name, feature: "pairing code" },
    });
  }
  return adapter.requestPairingCode(phone);
}

import { EngineCapabilityError } from "../kernel/errors/index.js";
import type { CapabilityFlags, EngineAdapter } from "./contract.js";

/**
 * Asserts that the adapter supports a capability before a feature is used.
 * Throws EngineCapabilityError when the flag is false. Silent fallback is forbidden.
 */
export function assertCapability(adapter: EngineAdapter, flag: keyof CapabilityFlags, feature: string): void {
  if (!adapter.capabilities[flag]) {
    throw new EngineCapabilityError({
      message: `engine ${adapter.name} does not support ${feature}`,
      context: { engine: adapter.name, feature, flag },
    });
  }
}

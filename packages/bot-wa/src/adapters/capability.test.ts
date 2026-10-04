import { describe, expect, it } from "vitest";
import { EngineCapabilityError } from "../kernel/errors/index.js";
import { assertCapability } from "./capability.js";
import type { CapabilityFlags, EngineAdapter } from "./contract.js";

function createStubAdapter(flags: Partial<CapabilityFlags>): EngineAdapter {
  const capabilities: CapabilityFlags = {
    supportsPairingCode: true,
    supportsEdit: true,
    supportsReaction: true,
    supportsDelete: true,
    supportsGroupAdmin: true,
    supportsPresence: true,
    supportsCallEvents: true,
    supportsMultiDevice: true,
    ...flags,
  };
  return {
    name: "baileys",
    capabilities,
    connect: async () => undefined,
    disconnect: async () => undefined,
    getConnectionStatus: () => "disconnected",
    sendMessage: async () => "id",
    editMessage: async () => undefined,
    reactToMessage: async () => undefined,
    deleteMessage: async () => undefined,
    groupParticipants: async () => [],
    groupSetSubject: async () => undefined,
    downloadMedia: async () => new Uint8Array([1]),
    getProfileName: async () => "name",
    onEvent: () => () => undefined,
    getAuthState: async () => ({}),
    setAuthState: async () => undefined,
  };
}

describe("assertCapability", () => {
  it("should throw EngineCapabilityError when the flag is false", () => {
    const adapter = createStubAdapter({ supportsEdit: false });
    expect(() => assertCapability(adapter, "supportsEdit", "message edit")).toThrow(EngineCapabilityError);
  });

  it("should not throw when the flag is true", () => {
    const adapter = createStubAdapter({});
    expect(() => assertCapability(adapter, "supportsEdit", "message edit")).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { ConfigError } from "../../kernel/errors/index.js";
import type { CommandMetadata } from "./metadata.js";
import { createCommandRegistry } from "./registry.js";

function meta(name: string, aliases: readonly string[] = []): CommandMetadata {
  return { name, description: `desc ${name}`, permission: "user", cooldownMs: 0, aliases };
}

describe("CommandRegistry", () => {
  it("should resolve an alias when the command is registered with aliases", () => {
    const registry = createCommandRegistry();
    registry.register(meta("util.ping", ["p", "ping"]), async () => undefined);
    expect(registry.resolve("p")).toBe("util.ping");
    expect(registry.names()).toEqual(["util.ping"]);
  });

  it("should throw ConfigError when the same name is registered twice", () => {
    const registry = createCommandRegistry();
    registry.register(meta("util.ping"), async () => undefined);
    expect(() => registry.register(meta("util.ping"), async () => undefined)).toThrow(ConfigError);
  });

  it("should throw ConfigError when an alias collides with an existing alias", () => {
    const registry = createCommandRegistry();
    registry.register(meta("util.ping", ["p"]), async () => undefined);
    expect(() => registry.register(meta("util.pong", ["p"]), async () => undefined)).toThrow(ConfigError);
  });
});

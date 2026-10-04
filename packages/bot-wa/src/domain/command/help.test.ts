import { describe, expect, it } from "vitest";
import type { CommandMetadata } from "./metadata.js";
import { createCommandRegistry } from "./registry.js";
import { generateHelp } from "./help.js";

function meta(name: string): CommandMetadata {
  return { name, description: `desc ${name}`, permission: "user", cooldownMs: 0 };
}

describe("generateHelp", () => {
  it("should include the first prefix and every command name when generated", () => {
    const registry = createCommandRegistry();
    registry.register(meta("util.ping"), async () => undefined);
    registry.register(meta("admin.ban"), async () => undefined);
    const help = generateHelp(registry.list(), [".", "!"]);
    expect(help).toContain(".util.ping [user] desc util.ping");
    expect(help).toContain(".admin.ban [user] desc admin.ban");
    expect(help.indexOf(".admin.ban")).toBeLessThan(help.indexOf(".util.ping"));
  });
});

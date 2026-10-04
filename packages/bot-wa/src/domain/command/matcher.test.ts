import { describe, expect, it } from "vitest";
import { matchCommand } from "./matcher.js";

const NAMES = ["util.ping", "admin.ban"];
const ALIASES = { p: "util.ping", ping: "util.ping" };
const PREFIXES = [".", "!", "/"];

describe("matchCommand", () => {
  it("should resolve an alias to the canonical name when the alias is used", () => {
    const result = matchCommand("!ping now", PREFIXES, NAMES, ALIASES);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("util.ping");
    expect(result?.argsRaw).toBe("now");
  });

  it("should match a namespaced command when the full name is typed", () => {
    const result = matchCommand("/admin.ban ana", PREFIXES, NAMES, ALIASES);
    expect(result?.name).toBe("admin.ban");
    expect(result?.argsRaw).toBe("ana");
  });

  it("should return null when no prefix is present", () => {
    expect(matchCommand("ping", PREFIXES, NAMES, ALIASES)).toBeNull();
  });

  it("should return null when the head is not a known command", () => {
    expect(matchCommand(".unknown x", PREFIXES, NAMES, ALIASES)).toBeNull();
  });
});

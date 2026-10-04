import { describe, expect, it } from "vitest";
import { redact } from "./redactor.js";

describe("redact", () => {
  it("should redact sensitive field names at any depth", () => {
    const input = { user: { botToken: "abc123", nested: { apiKey: "xyz" } }, safe: "keep" };
    const out = redact(input) as Record<string, unknown>;
    const user = out["user"] as Record<string, unknown>;
    const nested = user["nested"] as Record<string, unknown>;
    expect(user["botToken"]).toBe("[REDACTED]");
    expect(nested["apiKey"]).toBe("[REDACTED]");
    expect(out["safe"]).toBe("keep");
  });

  it("should redact a jwt pattern inside a plain string", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdef1234567890abcdef";
    const out = redact(`auth header ${jwt}`) as string;
    expect(out).not.toContain(jwt);
    expect(out).toContain("[REDACTED]");
  });

  it("should redact a bearer token pattern inside a string", () => {
    const out = redact("Authorization: Bearer abcdef1234567890") as string;
    expect(out).not.toContain("abcdef1234567890");
  });

  it("should keep non sensitive values untouched", () => {
    const input = { level: "info", count: 3, tags: ["a", "b"] };
    expect(redact(input)).toEqual(input);
  });
});

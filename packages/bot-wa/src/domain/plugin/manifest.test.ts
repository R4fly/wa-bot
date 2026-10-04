import { describe, expect, it } from "vitest";
import { validateManifest } from "./manifest.js";

function validManifest(): Record<string, unknown> {
  return {
    name: "@scope/echo",
    version: "1.0.0",
    author: "ana",
    license: "MIT",
    engines: ">=0.6.0 <1.0.0",
    permissions: ["read:message", "send:message"],
    entry: "dist/index.js",
    hash: "a".repeat(64),
    signature: "c2ln",
    publisher: "cHVi",
  };
}

describe("validateManifest", () => {
  it("should accept a complete manifest when every field is valid", () => {
    const result = validateManifest(validManifest());
    expect(result.ok).toBe(true);
  });

  it("should report an issue when a required field is missing", () => {
    const input = validManifest();
    delete input["author"];
    const result = validateManifest(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.field === "author")).toBe(true);
    }
  });

  it("should reject an undeclared permission value", () => {
    const input = validManifest();
    input["permissions"] = ["read:everything"];
    const result = validateManifest(input);
    expect(result.ok).toBe(false);
  });

  it("should reject an entry path that escapes the plugin root", () => {
    const input = validManifest();
    input["entry"] = "../escape.js";
    const result = validateManifest(input);
    expect(result.ok).toBe(false);
  });
});

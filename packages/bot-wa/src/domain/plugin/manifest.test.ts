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

function firstIssueField(input: Record<string, unknown>): string | undefined {
  const result = validateManifest(input);
  if (result.ok) {
    return undefined;
  }
  return result.issues[0]?.field;
}

describe("validateManifest", () => {
  it("should accept a complete manifest when every field is valid", () => {
    expect(validateManifest(validManifest()).ok).toBe(true);
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

  it("should reject a root value that is not an object", () => {
    const result = validateManifest("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.field).toBe("(root)");
    }
  });

  it("should reject a version that is not semantic", () => {
    const input = validManifest();
    input["version"] = "1.2";
    expect(firstIssueField(input)).toBe("version");
  });

  it("should reject a hash that is not 64 hex characters", () => {
    const input = validManifest();
    input["hash"] = "short";
    expect(firstIssueField(input)).toBe("hash");
  });

  it("should reject a signature that is not base64", () => {
    const input = validManifest();
    input["signature"] = "not-base64!!";
    expect(firstIssueField(input)).toBe("signature");
  });

  it("should reject a publisher that is not base64", () => {
    const input = validManifest();
    input["publisher"] = "not-base64!!";
    expect(firstIssueField(input)).toBe("publisher");
  });

  it("should reject permissions that are not an array", () => {
    const input = validManifest();
    input["permissions"] = "read:message";
    expect(firstIssueField(input)).toBe("permissions");
  });

  it("should reject a duplicated permission value", () => {
    const input = validManifest();
    input["permissions"] = ["read:message", "read:message"];
    const result = validateManifest(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.expected === "unique permission values")).toBe(true);
    }
  });

  it("should reject an entry path with a backslash", () => {
    const input = validManifest();
    input["entry"] = "dist\\index.js";
    expect(firstIssueField(input)).toBe("entry");
  });

  it("should reject an absolute entry path", () => {
    const input = validManifest();
    input["entry"] = "/etc/passwd";
    expect(firstIssueField(input)).toBe("entry");
  });
});

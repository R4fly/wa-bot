import { describe, expect, it } from "vitest";
import { createSandboxPolicy } from "./policy.js";

describe("createSandboxPolicy", () => {
  it("should grant send message when the permission is declared", () => {
    const policy = createSandboxPolicy(["send:message"]);
    expect(policy.allows("send:message")).toBe(true);
    expect(policy.allows("storage:get")).toBe(false);
  });

  it("should grant both storage APIs when access storage is declared", () => {
    const policy = createSandboxPolicy(["access:storage"]);
    expect(policy.allows("storage:get")).toBe(true);
    expect(policy.allows("storage:set")).toBe(true);
  });

  it("should grant nothing when no permission is declared", () => {
    const policy = createSandboxPolicy([]);
    expect(policy.allowedApis.size).toBe(0);
  });

  it("should grant no API for permissions without a wired host API", () => {
    const policy = createSandboxPolicy(["access:fs", "access:network"]);
    expect(policy.allowedApis.size).toBe(0);
  });
});

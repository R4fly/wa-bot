import { describe, expect, it } from "vitest";
import { compareSemver, parseSemver, satisfiesSemverRange } from "./semver.js";

describe("semver", () => {
  it("should parse an exact version and reject malformed input", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver("1.2")).toBeNull();
    expect(parseSemver("a.b.c")).toBeNull();
  });

  it("should order versions by major then minor then patch", () => {
    const a = parseSemver("1.2.3");
    const b = parseSemver("1.10.0");
    expect(a !== null && b !== null && compareSemver(a, b)).toBe(-1);
  });

  it("should accept a version inside a lower and upper bound range", () => {
    expect(satisfiesSemverRange("0.6.0", ">=0.6.0 <1.0.0")).toBe(true);
    expect(satisfiesSemverRange("1.0.0", ">=0.6.0 <1.0.0")).toBe(false);
  });

  it("should apply caret semantics per major and minor rules", () => {
    expect(satisfiesSemverRange("0.6.5", "^0.6.0")).toBe(true);
    expect(satisfiesSemverRange("0.7.0", "^0.6.0")).toBe(false);
    expect(satisfiesSemverRange("1.9.9", "^1.2.0")).toBe(true);
    expect(satisfiesSemverRange("2.0.0", "^1.2.0")).toBe(false);
  });

  it("should reject an empty range", () => {
    expect(satisfiesSemverRange("1.0.0", "  ")).toBe(false);
  });
});

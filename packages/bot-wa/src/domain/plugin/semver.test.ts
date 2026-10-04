import { describe, expect, it } from "vitest";
import { compareSemver, parseSemver, satisfiesSemverRange } from "./semver.js";

describe("semver", () => {
  it("should parse a valid version string", () => {
    const semver = parseSemver("1.2.3");
    expect(semver).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it("should return null when the version is malformed", () => {
    expect(parseSemver("1.2")).toBeNull();
    expect(parseSemver("a.b.c")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });

  it("should rank versions by major then minor then patch", () => {
    expect(compareSemver(parseSemver("1.0.0")!, parseSemver("2.0.0")!)).toBe(-1);
    expect(compareSemver(parseSemver("1.1.0")!, parseSemver("1.0.0")!)).toBe(1);
    expect(compareSemver(parseSemver("1.0.1")!, parseSemver("1.0.1")!)).toBe(0);
  });

  it("should accept a caret range within the same major", () => {
    expect(satisfiesSemverRange("1.5.0", "^1.2.0")).toBe(true);
    expect(satisfiesSemverRange("2.0.0", "^1.2.0")).toBe(false);
  });

  it("should bound a caret range at the next minor when major is zero", () => {
    expect(satisfiesSemverRange("0.6.5", "^0.6.0")).toBe(true);
    expect(satisfiesSemverRange("0.7.0", "^0.6.0")).toBe(false);
  });

  it("should bound a caret range at the next patch when major and minor are zero", () => {
    expect(satisfiesSemverRange("0.0.3", "^0.0.3")).toBe(true);
    expect(satisfiesSemverRange("0.0.4", "^0.0.3")).toBe(false);
  });

  it("should accept a tilde range within the same minor", () => {
    expect(satisfiesSemverRange("1.2.9", "~1.2.0")).toBe(true);
    expect(satisfiesSemverRange("1.3.0", "~1.2.0")).toBe(false);
  });

  it("should apply comparison operators at their boundaries", () => {
    expect(satisfiesSemverRange("1.0.0", ">=1.0.0")).toBe(true);
    expect(satisfiesSemverRange("1.0.0", ">1.0.0")).toBe(false);
    expect(satisfiesSemverRange("1.0.0", "<=1.0.0")).toBe(true);
    expect(satisfiesSemverRange("1.0.0", "<1.0.0")).toBe(false);
    expect(satisfiesSemverRange("1.0.0", "=1.0.0")).toBe(true);
    expect(satisfiesSemverRange("1.0.0", "1.0.0")).toBe(true);
  });

  it("should require every constraint when the range has several parts", () => {
    expect(satisfiesSemverRange("1.5.0", ">=1.0.0 <2.0.0")).toBe(true);
    expect(satisfiesSemverRange("2.5.0", ">=1.0.0 <2.0.0")).toBe(false);
  });

  it("should reject when a constraint token is unparseable", () => {
    expect(satisfiesSemverRange("1.0.0", "^abc")).toBe(false);
    expect(satisfiesSemverRange("1.0.0", ">=1.0.0 <xyz")).toBe(false);
  });

  it("should reject when the range itself is unparseable", () => {
    expect(satisfiesSemverRange("1.0.0", "not a range")).toBe(false);
  });
});

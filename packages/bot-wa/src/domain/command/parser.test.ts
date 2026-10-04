import { describe, expect, it } from "vitest";
import { parseArgs } from "./parser.js";

describe("parseArgs", () => {
  it("should keep quoted text as one positional when quotes are used", () => {
    const result = parseArgs('ban "ana budi" 7');
    expect(result.positional).toEqual(["ban", "ana budi", "7"]);
  });

  it("should read the next token as flag value when flag is followed by a value", () => {
    const result = parseArgs("--reason spam --force");
    expect(result.flags["reason"]).toBe("spam");
    expect(result.flags["force"]).toBe(true);
  });

  it("should split on equals when flag uses equals syntax", () => {
    const result = parseArgs("--days=3");
    expect(result.flags["days"]).toBe("3");
  });

  it("should collect everything after a bare double dash as rest when rest syntax is used", () => {
    const result = parseArgs("add -- --raw --tokens");
    expect(result.positional).toEqual(["add"]);
    expect(result.rest).toEqual(["--raw", "--tokens"]);
  });
});
import { describe, expect, it } from "vitest";
import { scaffoldTemplate, TEMPLATE_NAMES } from "./scaffold.js";

describe("scaffoldTemplate", () => {
  it("should write the core files for the minimal template", async () => {
    const written: string[] = [];
    await scaffoldTemplate("minimal", "my-bot", async (path) => {
      written.push(path);
    });
    expect(written).toContain("package.json");
    expect(written).toContain("src/index.ts");
    expect(written).toContain(".env.example");
  });

  it("should add a commands folder file for the command based template", async () => {
    const written: string[] = [];
    await scaffoldTemplate("command-based", "my-bot", async (path) => {
      written.push(path);
    });
    expect(written).toContain("src/commands/ping.ts");
  });

  it("should expose exactly six templates", () => {
    expect(TEMPLATE_NAMES.length).toBe(6);
  });
});

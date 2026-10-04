import { describe, expect, it } from "vitest";
import { generate, isTemplateName } from "./generator.js";

describe("generator", () => {
  it("should accept the six template names and reject others", () => {
    expect(isTemplateName("minimal")).toBe(true);
    expect(isTemplateName("multi-session")).toBe(true);
    expect(isTemplateName("nope")).toBe(false);
  });

  it("should write every template file through the injected writer", async () => {
    const written: string[] = [];
    const result = await generate({ template: "minimal", projectName: "demo" }, async (path) => {
      written.push(path);
    });
    expect(result.created.length).toBe(written.length);
    expect(written).toContain("package.json");
    expect(written).toContain("src/index.ts");
  });
});

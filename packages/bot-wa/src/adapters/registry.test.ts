import { describe, expect, it } from "vitest";
import type { EngineName } from "../kernel/config/schema.js";
import { createEngineAdapter } from "./registry.js";

describe("createEngineAdapter", () => {
  it("should return the baileys adapter when engine is baileys", () => {
    expect(createEngineAdapter({ engine: "baileys" }).name).toBe("baileys");
  });

  it("should return the wwebjs adapter when engine is wwebjs", () => {
    expect(createEngineAdapter({ engine: "wwebjs" }).name).toBe("wwebjs");
  });

  it("should throw ConfigError when engine is unsupported", () => {
    expect(() => createEngineAdapter({ engine: "nope" as EngineName })).toThrow();
  });
});

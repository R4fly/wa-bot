import { describe, expect, it } from "vitest";
import { ConfigError } from "./errors/index.js";
import { createContainer } from "./container.js";

describe("Container", () => {
  it("should resolve the same instance twice when the factory is lazy", () => {
    const container = createContainer();
    let calls = 0;
    container.register("service", () => {
      calls += 1;
      return { id: calls };
    });
    const first = container.resolve<{ id: number }>("service");
    const second = container.resolve<{ id: number }>("service");
    expect(first).toBe(second);
    expect(calls).toBe(1);
  });

  it("should throw ConfigError when a key is not registered", () => {
    const container = createContainer();
    expect(() => container.resolve("missing")).toThrow(ConfigError);
  });

  it("should throw ConfigError when registration is duplicated", () => {
    const container = createContainer();
    container.register("dup", () => 1);
    expect(() => container.register("dup", () => 2)).toThrow(ConfigError);
  });

  it("should throw ConfigError when two keys depend on each other", () => {
    const container = createContainer();
    container.register("a", (c) => c.resolve("b"));
    container.register("b", (c) => c.resolve("a"));
    expect(() => container.resolve("a")).toThrow(ConfigError);
  });
});

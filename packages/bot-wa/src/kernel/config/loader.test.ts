import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError } from "../errors/index.js";
import { loadConfig } from "./loader.js";

describe("loadConfig", () => {
  it("should return defaults when no sources are given", async () => {
    const config = await loadConfig({});
    expect(config.engine.name).toBe("baileys");
    expect(config.session.storage).toBe("file");
    expect(config.logger.level).toBe("info");
  });

  it("should apply precedence when cli, env, and file all set the same field", async () => {
    const dir = await mkdtemp(join(tmpdir(), "botwa-config-"));
    const filePath = join(dir, "bot-wa.config.json");
    await writeFile(filePath, JSON.stringify({ engine: { name: "wwebjs" }, logger: { level: "warn" } }), "utf8");
    const config = await loadConfig({
      filePath,
      env: { BOTWA_LOGGER_LEVEL: "error" },
      cli: { LOGGER_LEVEL: "fatal" },
    });
    expect(config.engine.name).toBe("wwebjs");
    expect(config.logger.level).toBe("fatal");
  });

  it("should throw ConfigError with field and expected value when a field is invalid", async () => {
    const error = await loadConfig({ env: { BOTWA_ENGINE_NAME: "telegram" } }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ConfigError);
    const typed = error as ConfigError;
    expect(typed.message).toContain("engine.name");
    expect(typed.message).toContain("one of baileys, wwebjs");
  });

  it("should throw ConfigError when the config file is missing", async () => {
    const error = await loadConfig({ filePath: join(tmpdir(), "does-not-exist-botwa.json") }).catch(
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(ConfigError);
  });
});

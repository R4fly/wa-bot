import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkerEntryPath, spawnSandboxWorker } from "./process-transport.js";

const TALK_FIXTURE = `process.stdout.write("hello\\n");\nprocess.exit(0);\n`;
const WAIT_FIXTURE = `process.stdin.resume();\nsetTimeout(() => {}, 5000);\n`;

async function writeFixture(content: string, name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "botwa-transport-"));
  const path = join(dir, name);
  await writeFile(path, content, "utf8");
  return path;
}

describe("resolveWorkerEntryPath", () => {
  it("should return a non-empty string when called", () => {
    const path = resolveWorkerEntryPath();
    expect(typeof path).toBe("string");
    expect(path.length).toBeGreaterThan(0);
  });

  it("should point at worker-entry.js beside the built bundle", () => {
    const path = resolveWorkerEntryPath();
    expect(path.endsWith("worker-entry.js")).toBe(true);
  });
});

describe("spawnSandboxWorker", () => {
  it("should deliver worker stdout lines through the channel", async () => {
    const fixture = await writeFixture(TALK_FIXTURE, "talk.mjs");
    const result = spawnSandboxWorker({ workerEntryPath: fixture });
    const lines: string[] = [];
    result.channel.onLine((line) => {
      lines.push(line);
    });
    const code = await new Promise<number | null>((resolve) => {
      result.process.on("close", resolve);
    });
    expect(code).toBe(0);
    expect(lines).toContain("hello");
    expect(result.channel.closed).toBe(true);
  });

  it("should close the channel when kill is called on a waiting worker", async () => {
    const fixture = await writeFixture(WAIT_FIXTURE, "wait.mjs");
    const result = spawnSandboxWorker({ workerEntryPath: fixture });
    const closed = new Promise<void>((resolve) => {
      result.channel.onClose(() => resolve());
    });
    result.kill();
    await closed;
    expect(result.channel.closed).toBe(true);
  });

  it("should mark the channel closed when the worker exits on its own", async () => {
    const fixture = await writeFixture(TALK_FIXTURE, "talk2.mjs");
    const result = spawnSandboxWorker({ workerEntryPath: fixture });
    await new Promise<void>((resolve) => {
      result.channel.onClose(() => resolve());
    });
    expect(result.channel.closed).toBe(true);
  });
});

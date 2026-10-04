import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createFileStorage } from "@baehaqirafly3/bot-wa";
import { EXIT, run, type CliIo } from "./cli.js";

function capture(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { stdout: (l) => out.push(l), stderr: (l) => err.push(l) }, out, err };
}

describe("cli run", () => {
  it("should print the version and exit zero", async () => {
    const cap = capture();
    const code = await run(["version"], { io: cap.io });
    expect(code).toBe(EXIT.OK);
    expect(cap.out[0]).toBe("0.1.0");
  });

  it("should exit two for an unknown command", async () => {
    const cap = capture();
    const code = await run(["nonsense"], { io: cap.io });
    expect(code).toBe(EXIT.BAD_ARGS);
  });

  it("should add and list a session against file storage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "botwa-cli-"));
    const storage = createFileStorage(dir);
    const cap = capture();
    const deps = { io: cap.io, openStorage: () => storage };
    expect(await run(["session", "add", "main"], deps)).toBe(EXIT.OK);
    expect(await run(["session", "list"], deps)).toBe(EXIT.OK);
    expect(cap.out[1]).toContain("main");
  });

  it("should exit zero when validating the default config", async () => {
    const cap = capture();
    const code = await run(["config", "validate"], { io: cap.io });
    expect(code).toBe(EXIT.OK);
  });
});

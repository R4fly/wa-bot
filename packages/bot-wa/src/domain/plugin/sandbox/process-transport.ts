import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { SandboxChannel } from "./channel.js";
import { SessionCipher } from "./protocol.js";

/** Dependencies for spawning a sandbox worker process. */
export interface ProcessTransportDeps {
  readonly workerEntryPath: string;
  readonly nodeExecutable?: string;
  readonly maxMemoryMb?: number;
  readonly enablePermissionModel?: boolean;
}

/** Result of spawning a sandbox worker process. */
export interface ProcessTransportResult {
  readonly channel: SandboxChannel;
  readonly cipher: SessionCipher;
  readonly process: ChildProcess;
  readonly kill: () => void;
}

/**
 * Spawns a sandbox worker as a separate Node.js process with memory limits
 * and optional permission model. Returns a channel connected to the worker's
 * stdin and stdout, plus a kill function for graceful shutdown.
 */
export function spawnSandboxWorker(deps: ProcessTransportDeps): ProcessTransportResult {
  const nodeExe = deps.nodeExecutable ?? process.execPath;
  const maxMem = deps.maxMemoryMb ?? 64;
  const key = SessionCipher.generateKey();
  const keyBase64 = key.toString("base64");

  const args: string[] = [`--max-old-space-size=${maxMem}`, deps.workerEntryPath];

  if (deps.enablePermissionModel ?? false) {
    args.unshift("--experimental-permission");
    args.push("--allow-fs-read=*");
    args.push("--deny-fs-write=*");
    args.push("--deny-child-process");
    args.push("--deny-worker");
  }

  const child = spawn(nodeExe, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      BOTWA_SANDBOX_KEY: keyBase64,
    },
  });

  let closed = false;
  const lineHandlers: Array<(line: string) => void> = [];
  const closeHandlers: Array<() => void> = [];

  function markClosed(): void {
    if (!closed) {
      closed = true;
      for (const handler of [...closeHandlers]) {
        handler();
      }
    }
  }

  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    for (const line of text.split("\n")) {
      if (line.length > 0) {
        for (const handler of [...lineHandlers]) {
          handler(line);
        }
      }
    }
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[sandbox-worker] ${chunk.toString("utf8")}`);
  });

  child.on("close", markClosed);
  child.on("error", markClosed);

  const channel: SandboxChannel = {
    get closed(): boolean {
      return closed;
    },
    send(line: string): void {
      if (!closed && child.stdin && !child.stdin.destroyed) {
        child.stdin.write(`${line}\n`);
      }
    },
    onLine(handler: (line: string) => void): void {
      lineHandlers.push(handler);
    },
    onClose(handler: () => void): void {
      closeHandlers.push(handler);
    },
    close(): void {
      if (!closed) {
        closed = true;
        child.kill("SIGTERM");
        for (const handler of [...closeHandlers]) {
          handler();
        }
      }
    },
  };

  const cipher = new SessionCipher(key);

  return {
    channel,
    cipher,
    process: child,
    kill: () => channel.close(),
  };
}

/**
 * Resolves the worker entry path next to the built index bundle.
 * Valid in built output where dist/index.js and dist/worker-entry.js sit
 * side by side. Tests assert the suffix only, never spawn from source.
 */
export function resolveWorkerEntryPath(): string {
  return fileURLToPath(new URL("./worker-entry.js", import.meta.url));
}

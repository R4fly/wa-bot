import { runWorkerRuntime } from "./worker-runtime.js";
import { SessionCipher } from "./protocol.js";
import type { SandboxChannel } from "./channel.js";

/**
 * Entry point for the sandbox worker process.
 * Reads the session key from BOTWA_SANDBOX_KEY environment variable,
 * sets up stdin/stdout as the channel, and runs the worker runtime.
 */
async function main(): Promise<void> {
  const keyBase64 = process.env.BOTWA_SANDBOX_KEY;
  if (!keyBase64) {
    process.stderr.write("BOTWA_SANDBOX_KEY not set\n");
    process.exit(1);
  }

  const key = Buffer.from(keyBase64, "base64");
  const cipher = new SessionCipher(key);

  const channel: SandboxChannel = {
    closed: false,
    send(line: string): void {
      process.stdout.write(`${line}\n`);
    },
    onLine(handler: (line: string) => void): void {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        const text = chunk as string;
        for (const line of text.split("\n")) {
          if (line.length > 0) {
            handler(line);
          }
        }
      });
    },
    onClose(handler: () => void): void {
      process.stdin.on("close", handler);
    },
    close(): void {
      process.exit(0);
    },
  };

  const entrySpecifier = process.env.BOTWA_SANDBOX_ENTRY ?? "plugin";

  await runWorkerRuntime({
    channel,
    cipher,
    loadModule: async (specifier: string) => {
      const module = await import(specifier);
      return module.default ?? module;
    },
    entrySpecifier,
  });
}

main().catch((error) => {
  process.stderr.write(`worker-entry failed: ${error instanceof Error ? error.message : "unknown"}\n`);
  process.exit(1);
});

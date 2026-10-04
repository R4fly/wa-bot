import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  backupSession,
  ConfigError,
  createBot,
  createEngineAdapter,
  createFileStorage,
  createMemoryStorage,
  createTrustStore,
  generateSigningKeypair,
  loadConfig,
  migrateSession,
  parseArgs as parseCliArgs,
  qrBase64,
  qrRaw,
  requestPairingCode,
  restoreSession,
  sha256Hex,
  verifyPlugin,
  type BotConfig,
  type StorageAdapter,
} from "@baehaqirafly3/bot-wa";
import { scaffoldTemplate, TEMPLATE_NAMES, type TemplateName } from "./scaffold.js";


/** Exit codes: 0 ok, 1 general, 2 bad arguments, 3 bad config, 4 runtime failure. */
export const EXIT = { OK: 0, GENERAL: 1, BAD_ARGS: 2, BAD_CONFIG: 3, RUNTIME: 4 } as const;

/** IO abstraction so tests capture output. */
export interface CliIo {
  stdout(line: string): void;
  stderr(line: string): void;
}

/** Dependencies of one CLI run. Storage factory is injectable for tests. */
export interface CliDeps {
  io: CliIo;
  openStorage?: (config: BotConfig) => StorageAdapter;
  now?: () => number;
}

const VERSION = "0.1.0";

function openStorageFor(config: BotConfig): StorageAdapter {
  return createStorageAdapter({
    storage: config.session.storage,
    storagePath: config.session.storagePath,
    ...(config.redisUrl === undefined ? {} : { redisUrl: config.redisUrl }),
  });
}

/** Runs one CLI invocation and returns the process exit code. */
export async function run(argv: readonly string[], deps: CliDeps): Promise<number> {
  const parsed = parseCliArgs(argv.join(" "));
  const [head, ...rest] = parsed.positional as readonly string[];
  const command = head ?? "";
  const json = parsed.flags["json"] === true;
  const openStorage = deps.openStorage ?? openStorageFor;
  const emit = (value: unknown): void => {
    deps.io.stdout(json ? JSON.stringify(value) : String(value));
  };

  try {
    if (command === "version") {
      emit(VERSION);
      return EXIT.OK;
    }
    if (command === "config" && rest[0] === "validate") {
      const config = await loadConfig({ cli: {}, env: process.env });
      emit({ ok: true, engine: config.engine.name });
      return EXIT.OK;
    }
    if (command === "config" && rest[0] === "print") {
      const config = await loadConfig({ cli: {}, env: process.env });
      emit(config);
      return EXIT.OK;
    }

    const config = await loadConfig({ cli: {}, env: process.env });
    const storage = openStorage(config);

    if (command === "session" && rest[0] === "list") {
      const list = (await storage.get("cli", "sessions")) as string[] | undefined;
      emit(list ?? []);
      return EXIT.OK;
    }
    if (command === "session" && rest[0] === "add") {
      const name = rest[1];
      if (name === undefined) {
        return EXIT.BAD_ARGS;
      }
      const list = ((await storage.get("cli", "sessions")) as string[] | undefined) ?? [];
      if (list.includes(name)) {
        deps.io.stderr(`session exists: ${name}`);
        return EXIT.GENERAL;
      }
      await storage.set("cli", "sessions", [...list, name]);
      await storage.set(`session:${name}`, "marker", {
        createdAt: new Date(deps.now?.() ?? Date.now()).toISOString(),
      });
      emit({ added: name });
      return EXIT.OK;
    }
    if (command === "session" && rest[0] === "remove") {
      const name = rest[1];
      if (name === undefined) {
        return EXIT.BAD_ARGS;
      }
      const list = ((await storage.get("cli", "sessions")) as string[] | undefined) ?? [];
      await storage.set("cli", "sessions", list.filter((item) => item !== name));
      await storage.clear(`session:${name}`);
      emit({ removed: name });
      return EXIT.OK;
    }
    if (command === "session" && rest[0] === "backup") {
      const name = rest[1];
      const path = rest[2];
      if (name === undefined || path === undefined) {
        return EXIT.BAD_ARGS;
      }
      const snapshot = await backupSession(storage, name, new Date(deps.now?.() ?? Date.now()).toISOString());
      await writeFile(path, JSON.stringify(snapshot), "utf8");
      emit({ backedUp: name, path });
      return EXIT.OK;
    }
    if (command === "session" && rest[0] === "restore") {
      const name = rest[1];
      const path = rest[2];
      if (name === undefined || path === undefined) {
        return EXIT.BAD_ARGS;
      }
      const raw = await readFile(path, "utf8");
      await restoreSession(storage, JSON.parse(raw) as Parameters<typeof restoreSession>[1]);
      emit({ restored: name });
      return EXIT.OK;
    }
    if (command === "session" && rest[0] === "qr") {
      const adapter = createEngineAdapter({ engine: config.engine.name, sessionId: config.session.name });
      const state: { qr: string | null } = { qr: null };
      adapter.onEvent((event) => {
        if (event.kind === "auth" && event.qr !== undefined) {
          state.qr = event.qr;
        }
      });
      await adapter.connect();
      const timeoutMs = Number(parsed.flags["timeout"] ?? 30_000);
      const started = Date.now();
      while (state.qr === null && Date.now() - started < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      await adapter.disconnect();
      if (state.qr === null) {
        deps.io.stderr("no QR received within timeout; terminal rendering arrives with the QR encoder decision");
        return EXIT.RUNTIME;
      }
      const qrValue = state.qr;
      emit({ raw: qrRaw(qrValue), base64: qrBase64(qrValue) });
      return EXIT.OK;
    }
    if (command === "session" && rest[0] === "pair") {
      const phone = rest[2];
      if (phone === undefined) {
        return EXIT.BAD_ARGS;
      }
      const adapter = createEngineAdapter({ engine: config.engine.name, sessionId: config.session.name });
      await adapter.connect();
      try {
        const code = await requestPairingCode(adapter, phone);
        emit({ pairingCode: code });
        return EXIT.OK;
      } finally {
        await adapter.disconnect();
      }
    }
    if (command === "plugin" && rest[0] === "keygen") {
      emit(generateSigningKeypair());
      return EXIT.OK;
    }
    if (command === "plugin" && rest[0] === "trust" && (rest[1] === "add" || rest[1] === "remove")) {
      const key = rest[2];
      if (key === undefined) {
        return EXIT.BAD_ARGS;
      }
      const trust = createTrustStore(storage);
      if (rest[1] === "add") {
        await trust.add(key, new Date(deps.now?.() ?? Date.now()).toISOString());
        emit({ trusted: true });
      } else {
        const removed = await trust.remove(key);
        emit({ removed });
      }
      return EXIT.OK;
    }
    if (command === "plugin" && rest[0] === "verify") {
      const dir = rest[1];
      if (dir === undefined) {
        return EXIT.BAD_ARGS;
      }
      const manifestRaw = await readFile(join(dir, "plugin.json"), "utf8");
      const entry = (JSON.parse(manifestRaw) as { entry?: string }).entry ?? "index.js";
      const bundle = new Uint8Array(await readFile(join(dir, entry)));
      const trust = createTrustStore(storage);
      const result = await verifyPlugin(JSON.parse(manifestRaw), bundle, {
        trustStore: trust,
        currentVersion: VERSION,
      });
      emit(result);
      return result.ok ? EXIT.OK : EXIT.GENERAL;
    }
    if (command === "plugin" && rest[0] === "list") {
      const keys = await storage.keys("plugins");
      const manifests: unknown[] = [];
      for (const key of keys) {
        manifests.push(await storage.get("plugins", key));
      }
      emit(manifests);
      return EXIT.OK;
    }
    if (command === "plugin" && rest[0] === "install") {
      const dir = rest[1];
      if (dir === undefined) {
        return EXIT.BAD_ARGS;
      }
      const manifestRaw = await readFile(join(dir, "plugin.json"), "utf8");
      const entry = (JSON.parse(manifestRaw) as { entry?: string }).entry ?? "index.js";
      const bundle = new Uint8Array(await readFile(join(dir, entry)));
      const trust = createTrustStore(storage);
      const result = await verifyPlugin(JSON.parse(manifestRaw), bundle, {
        trustStore: trust,
        currentVersion: VERSION,
      });
      if (!result.ok) {
        deps.io.stderr(`verification failed: ${result.reason}`);
        return EXIT.GENERAL;
      }
      await storage.set("plugins", result.manifest.name, {
        ...result.manifest,
        bundleHash: sha256Hex(bundle),
      });
      emit({ installed: result.manifest.name });
      return EXIT.OK;
    }
    if (command === "plugin" && rest[0] === "remove") {
      const name = rest[1];
      if (name === undefined) {
        return EXIT.BAD_ARGS;
      }
      const removed = await storage.delete("plugins", name);
      emit({ removed });
      return EXIT.OK;
    }
    if (command === "doctor") {
      const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
      checks.push({
        name: "node",
        ok: process.version.startsWith("v20") || process.version.startsWith("v22"),
        detail: process.version,
      });
      checks.push({ name: "config", ok: true, detail: config.engine.name });
      await storage.connect();
      checks.push({ name: "storage", ok: true, detail: config.session.storage });
      const failed = checks.filter((check) => !check.ok);
      emit(checks);
      return failed.length > 0 ? EXIT.RUNTIME : EXIT.OK;
    }
    if (command === "migrate") {
      const fromName = String(parsed.flags["from"] ?? "");
      const toName = String(parsed.flags["to"] ?? "");
      const dryRun = parsed.flags["dry-run"] === true;
      const sessionName = String(parsed.flags["session"] ?? config.session.name);
      const build = (name: string): StorageAdapter => {
        if (name === "memory") {
          return createMemoryStorage();
        }
        if (name === "file") {
          return createFileStorage(config.session.storagePath);
        }
        throw new ConfigError({
          message: `storage ${name} requires a peer dependency that is not installed yet`,
          context: { storage: name },
        });
      };
      const result = await migrateSession(build(fromName), build(toName), sessionName, dryRun);
      emit(result);
      return EXIT.OK;
    }
    if (command === "init") {
      const template = String(parsed.flags["template"] ?? "") as TemplateName;
      if (!(TEMPLATE_NAMES as readonly string[]).includes(template)) {
        deps.io.stderr(`unknown template; choose one of ${TEMPLATE_NAMES.join(", ")}`);
        return EXIT.BAD_ARGS;
      }
      const dir = String(parsed.flags["dir"] ?? template);
      await mkdir(dir, { recursive: true });
      await scaffoldTemplate(template, dir, async (relativePath, content) => {
        await writeFile(join(dir, relativePath), content, "utf8");
      });
      emit({ created: dir, template });
      return EXIT.OK;
    }
    if (command === "start" || command === "dev") {
      const bot = await createBot({ env: process.env });
      await bot.start();
      deps.io.stdout("bot running; press ctrl+c to stop");
      await new Promise<void>((resolve) => {
        process.once("SIGINT", () => resolve());
      });
      await bot.stop();
      return EXIT.OK;
    }
    deps.io.stderr("unknown command; run bot-wa version or bot-wa doctor");
    return EXIT.BAD_ARGS;
  } catch (error) {
    if (error instanceof ConfigError) {
      deps.io.stderr(error.message);
      return EXIT.BAD_CONFIG;
    }
    deps.io.stderr(error instanceof Error ? error.message : "unknown error");
    return EXIT.RUNTIME;
  }
}

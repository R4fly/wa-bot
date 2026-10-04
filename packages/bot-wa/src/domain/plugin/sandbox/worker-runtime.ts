import { randomUUID } from "node:crypto";
import type { SandboxChannel } from "./channel.js";
import { decodeLine, encodeLine, type SessionCipher } from "./protocol.js";
import {
  isApiResultFrame,
  isHostToWorkerFrame,
  type ApiCallFrame,
  type PluginApi,
  type PluginHandlerName,
  type PluginModule,
  type SandboxApiName,
  type WorkerToHostFrame,
} from "./types.js";

/** Dependencies of the sandbox side runtime. Module loading is injected. */
export interface WorkerRuntimeDeps {
  readonly channel: SandboxChannel;
  readonly cipher: SessionCipher;
  readonly loadModule: (specifier: string) => Promise<PluginModule>;
  readonly entrySpecifier: string;
}

/**
 * Sandbox side runtime. Loads the plugin module, dispatches handler
 * invocations from the host, and proxies plugin API calls back to the host
 * over the encrypted channel. Holds no permissions of its own.
 * Queues invoke requests that arrive before the module is loaded.
 */
export async function runWorkerRuntime(deps: WorkerRuntimeDeps): Promise<void> {
  const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let plugin: PluginModule | null = null;
  const invokeQueue: Array<{ handler: PluginHandlerName; callId: string; payload: unknown }> = [];

  function sendFrame(frame: WorkerToHostFrame): void {
    deps.channel.send(encodeLine(deps.cipher.encrypt(JSON.stringify(frame))));
  }

  function sendViolation(reason: string): void {
    sendFrame({ kind: "violation", reason });
  }

  function callApi(api: SandboxApiName, args: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const callId = randomUUID();
      pending.set(callId, { resolve, reject });
      const frame: ApiCallFrame = { kind: "api-call", callId, api, args };
      sendFrame(frame);
    });
  }

  const api: PluginApi = {
    sendMessage: (text) => callApi("send:message", { text }) as Promise<string>,
    storageGet: (key) => callApi("storage:get", { key }),
    storageSet: (key, value) => callApi("storage:set", { key, value }) as Promise<void>,
    schedulerAdd: (spec) => callApi("scheduler:add", { spec }) as Promise<string>,
    groupSetSubject: (subject) => callApi("group:set-subject", { subject }) as Promise<void>,
  };

  deps.channel.onLine((line) => {
    const frame = decodeLine(line);
    if (frame === null) {
      sendViolation("bad-frame");
      return;
    }
    let plaintext: string;
    try {
      plaintext = deps.cipher.decrypt(frame);
    } catch {
      sendViolation("decrypt-failed");
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(plaintext) as unknown;
    } catch {
      sendViolation("bad-json");
      return;
    }
    if (isApiResultFrame(message)) {
      const entry = pending.get(message.callId);
      if (entry === undefined) {
        return;
      }
      pending.delete(message.callId);
      if (message.ok) {
        entry.resolve(message.value);
      } else {
        entry.reject(new Error(message.error ?? "api call failed"));
      }
      return;
    }
    if (isHostToWorkerFrame(message)) {
      if (plugin === null) {
        invokeQueue.push({ handler: message.handler, callId: message.callId, payload: message.payload });
      } else {
        void handleInvoke(message.handler, message.callId, message.payload);
      }
      return;
    }
    sendViolation("unknown-frame");
  });

  try {
    plugin = await deps.loadModule(deps.entrySpecifier);
  } catch (error) {
    sendViolation(`load-failed: ${error instanceof Error ? error.message : "unknown"}`);
    deps.channel.close();
    return;
  }

  for (const { handler, callId, payload } of invokeQueue) {
    void handleInvoke(handler, callId, payload);
  }

  async function handleInvoke(handler: PluginHandlerName, callId: string, payload: unknown): Promise<void> {
    try {
      if (handler === "activate") {
        if (plugin !== null && plugin.activate !== undefined) {
          await plugin.activate(api);
        }
      } else if (plugin !== null && plugin.onMessage !== undefined) {
        await plugin.onMessage(api, payload as Parameters<NonNullable<PluginModule["onMessage"]>>[1]);
      }
      sendFrame({ kind: "handler-result", callId, ok: true });
    } catch (error) {
      sendFrame({
        kind: "handler-result",
        callId,
        ok: false,
        error: error instanceof Error ? error.message : "handler failed",
      });
    }
  }
}

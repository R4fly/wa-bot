import { randomUUID } from "node:crypto";
import { SandboxError } from "../../../kernel/errors/index.js";
import type { AuditSink, Clock } from "../../../types/internal.js";
import type { TypedEventBus } from "../../event/bus.js";
import type { SandboxChannel } from "./channel.js";
import { decodeLine, encodeLine, type SessionCipher } from "./protocol.js";
import type { SandboxPolicy } from "./policy.js";
import {
  isWorkerToHostFrame,
  type ApiResultFrame,
  type HostToWorkerFrame,
  type PluginHandlerName,
  type SandboxApiName,
} from "./types.js";

/** Host side implementations the sandbox may reach through the policy. */
export interface HostApiHandlers {
  sendMessage?(text: string): Promise<string>;
  storageGet?(key: string): Promise<unknown>;
  storageSet?(key: string, value: unknown): Promise<void>;
  schedulerAdd?(spec: unknown): Promise<string>;
  groupSetSubject?(subject: string): Promise<void>;
}

/** Dependencies of one sandbox host instance. */
export interface SandboxHostDeps {
  readonly channel: SandboxChannel;
  readonly cipher: SessionCipher;
  readonly policy: SandboxPolicy;
  readonly handlers: HostApiHandlers;
  readonly timeoutMs: number;
  readonly clock: Clock;
  readonly pluginName: string;
  readonly audit?: AuditSink;
  readonly bus?: TypedEventBus;
  readonly correlationId?: string;
}

interface PendingHandler {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Host side of one sandboxed plugin. Invokes plugin handlers under a
 * configurable timeout, answers plugin API calls only when the policy allows
 * them, and reports every violation to audit and the event bus. A sandbox
 * crash never propagates to the host process.
 */
export class SandboxHost {
  private readonly deps: SandboxHostDeps;
  private readonly pending = new Map<string, PendingHandler>();
  private failed = false;

  constructor(deps: SandboxHostDeps) {
    this.deps = deps;
    deps.channel.onLine((line) => this.onLine(line));
    deps.channel.onClose(() => this.onClose());
  }

  /** Reports whether the sandbox has crashed or been closed. */
  get closed(): boolean {
    return this.deps.channel.closed || this.failed;
  }

  /** Invokes one plugin handler and resolves when it completes. */
  invokeHandler(handler: PluginHandlerName, payload: unknown): Promise<void> {
    const callId = randomUUID();
    return new Promise<void>((resolve, reject) => {
      if (this.closed) {
        reject(
          new SandboxError({
            message: `sandbox already closed for plugin ${this.deps.pluginName}`,
            context: { plugin: this.deps.pluginName },
          }),
        );
        return;
      }
      const timer = this.deps.clock.setTimeout(() => {
        this.pending.delete(callId);
        this.violate("handler-timeout");
        reject(
          new SandboxError({
            message: `plugin handler exceeded ${this.deps.timeoutMs} ms`,
            context: { plugin: this.deps.pluginName, handler },
          }),
        );
      }, this.deps.timeoutMs);
      this.pending.set(callId, {
        resolve: () => {
          this.deps.clock.clearTimeout(timer);
          resolve();
        },
        reject: (error: unknown) => {
          this.deps.clock.clearTimeout(timer);
          reject(error);
        },
      });
      const frame: HostToWorkerFrame = { kind: "invoke-handler", handler, callId, payload };
      this.sendFrame(frame);
    });
  }

  /** Closes the sandbox channel. Pending invocations are rejected. */
  close(): void {
    this.deps.channel.close();
  }

  private sendFrame(frame: HostToWorkerFrame | ApiResultFrame): void {
    this.deps.channel.send(encodeLine(this.deps.cipher.encrypt(JSON.stringify(frame))));
  }

  private violate(reason: string): void {
    const correlationId = this.deps.correlationId ?? "sandbox";
    if (this.deps.audit !== undefined) {
      this.deps.audit.write({
        timestamp: new Date(this.deps.clock.now()).toISOString(),
        actor: "sandbox-host",
        action: "sandbox:violation",
        target: this.deps.pluginName,
        result: "error",
        correlationId,
        metadata: { reason },
      });
    }
    if (this.deps.bus !== undefined) {
      this.deps.bus.emit("sandbox:violation", {
        kind: "sandbox:violation",
        name: this.deps.pluginName,
        reason,
        correlationId,
      });
    }
  }

  private onClose(): void {
    this.failed = true;
    for (const [callId, entry] of [...this.pending.entries()]) {
      this.pending.delete(callId);
      entry.reject(
        new SandboxError({
          message: `sandbox worker crashed or closed for plugin ${this.deps.pluginName}`,
          context: { plugin: this.deps.pluginName, callId },
        }),
      );
    }
  }

  private onLine(line: string): void {
    const frame = decodeLine(line);
    if (frame === null) {
      this.violate("bad-frame");
      return;
    }
    let plaintext: string;
    try {
      plaintext = this.deps.cipher.decrypt(frame);
    } catch {
      this.violate("decrypt-failed");
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(plaintext) as unknown;
    } catch {
      this.violate("bad-json");
      return;
    }
    if (!isWorkerToHostFrame(message)) {
      this.violate("unknown-frame");
      return;
    }
    if (message.kind === "violation") {
      this.violate(message.reason);
      return;
    }
    if (message.kind === "handler-result") {
      const entry = this.pending.get(message.callId);
      if (entry === undefined) {
        return;
      }
      this.pending.delete(message.callId);
      if (message.ok) {
        entry.resolve();
      } else {
        entry.reject(
          new SandboxError({
            message: `plugin handler failed: ${message.error ?? "unknown"}`,
            context: { plugin: this.deps.pluginName },
          }),
        );
      }
      return;
    }
    void this.handleApiCall(message.callId, message.api, message.args);
  }

  private async handleApiCall(callId: string, api: SandboxApiName, args: unknown): Promise<void> {
    if (!this.deps.policy.allows(api)) {
      this.violate(`permission-denied: ${api}`);
      this.sendFrame({ kind: "api-result", callId, ok: false, error: `permission denied: ${api}` });
      return;
    }
    const record = args as Record<string, unknown>;
    try {
      switch (api) {
        case "send:message": {
          const handler = this.deps.handlers.sendMessage;
          if (handler === undefined) {
            throw new SandboxError({ message: "api not wired: send:message", context: { api } });
          }
          const value = await handler(String(record["text"] ?? ""));
          this.sendFrame({ kind: "api-result", callId, ok: true, value });
          return;
        }
        case "storage:get": {
          const handler = this.deps.handlers.storageGet;
          if (handler === undefined) {
            throw new SandboxError({ message: "api not wired: storage:get", context: { api } });
          }
          const value = await handler(String(record["key"] ?? ""));
          this.sendFrame({ kind: "api-result", callId, ok: true, value });
          return;
        }
        case "storage:set": {
          const handler = this.deps.handlers.storageSet;
          if (handler === undefined) {
            throw new SandboxError({ message: "api not wired: storage:set", context: { api } });
          }
          await handler(String(record["key"] ?? ""), record["value"]);
          this.sendFrame({ kind: "api-result", callId, ok: true });
          return;
        }
        case "scheduler:add": {
          const handler = this.deps.handlers.schedulerAdd;
          if (handler === undefined) {
            throw new SandboxError({ message: "api not wired: scheduler:add", context: { api } });
          }
          const value = await handler(record["spec"]);
          this.sendFrame({ kind: "api-result", callId, ok: true, value });
          return;
        }
        case "group:set-subject": {
          const handler = this.deps.handlers.groupSetSubject;
          if (handler === undefined) {
            throw new SandboxError({ message: "api not wired: group:set-subject", context: { api } });
          }
          await handler(String(record["subject"] ?? ""));
          this.sendFrame({ kind: "api-result", callId, ok: true });
          return;
        }
        default: {
          this.sendFrame({ kind: "api-result", callId, ok: false, error: `unknown api: ${api}` });
          return;
        }
      }
    } catch (error) {
      this.sendFrame({
        kind: "api-result",
        callId,
        ok: false,
        error: error instanceof Error ? error.message : "api failed",
      });
    }
  }
}

/** Creates one sandbox host for one plugin instance. */
export function createSandboxHost(deps: SandboxHostDeps): SandboxHost {
  return new SandboxHost(deps);
}

/** Names of host APIs a plugin may call when its permission grants them. */
export type SandboxApiName =
  | "send:message"
  | "storage:get"
  | "storage:set"
  | "scheduler:add"
  | "group:set-subject";

/** Read only view of an inbound message handed to plugin code. */
export interface PluginMessageView {
  readonly messageId: string;
  readonly senderJid: string;
  readonly chatJid: string;
  readonly body: string;
  readonly isGroup: boolean;
}

/** API surface injected into a plugin. Undeclared permissions are never wired. */
export interface PluginApi {
  sendMessage(text: string): Promise<string>;
  storageGet(key: string): Promise<unknown>;
  storageSet(key: string, value: unknown): Promise<void>;
  schedulerAdd(spec: unknown): Promise<string>;
  groupSetSubject(subject: string): Promise<void>;
}

/** Module contract a plugin entry file must satisfy. */
export interface PluginModule {
  activate?(api: PluginApi): Promise<void> | void;
  onMessage?(api: PluginApi, message: PluginMessageView): Promise<void> | void;
}

/** Handler names the host may invoke inside the sandbox. */
export type PluginHandlerName = "activate" | "onMessage";

/** Host to sandbox frame: invoke one plugin handler. */
export interface InvokeHandlerFrame {
  readonly kind: "invoke-handler";
  readonly handler: PluginHandlerName;
  readonly callId: string;
  readonly payload: unknown;
}

/** Sandbox to host frame: request a permitted API call. */
export interface ApiCallFrame {
  readonly kind: "api-call";
  readonly callId: string;
  readonly api: SandboxApiName;
  readonly args: unknown;
}

/** Host to sandbox frame: result of an API call. */
export interface ApiResultFrame {
  readonly kind: "api-result";
  readonly callId: string;
  readonly ok: boolean;
  readonly value?: unknown;
  readonly error?: string;
}

/** Sandbox to host frame: result of a handler invocation. */
export interface HandlerResultFrame {
  readonly kind: "handler-result";
  readonly callId: string;
  readonly ok: boolean;
  readonly error?: string;
}

/** Sandbox to host frame: self reported policy or protocol violation. */
export interface ViolationFrame {
  readonly kind: "violation";
  readonly reason: string;
}

/** Any frame the host sends to the sandbox. */
export type HostToWorkerFrame = InvokeHandlerFrame;

/** Any frame the sandbox sends to the host. */
export type WorkerToHostFrame = ApiCallFrame | HandlerResultFrame | ViolationFrame;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Schema guard for frames arriving from the host. */
export function isHostToWorkerFrame(value: unknown): value is HostToWorkerFrame {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value["kind"] === "invoke-handler" &&
    typeof value["callId"] === "string" &&
    (value["handler"] === "activate" || value["handler"] === "onMessage")
  );
}

/** Schema guard for frames arriving from the sandbox. */
export function isWorkerToHostFrame(value: unknown): value is WorkerToHostFrame {
  if (!isRecord(value)) {
    return false;
  }
  const kind = value["kind"];
  if (kind === "violation") {
    return typeof value["reason"] === "string";
  }
  if (typeof value["callId"] !== "string") {
    return false;
  }
  if (kind === "api-call") {
    return typeof value["api"] === "string";
  }
  if (kind === "handler-result") {
    return typeof value["ok"] === "boolean";
  }
  return false;
}

/** Schema guard for API result frames consumed by the sandbox. */
export function isApiResultFrame(value: unknown): value is ApiResultFrame {
  return isRecord(value) && value["kind"] === "api-result" && typeof value["callId"] === "string";
}

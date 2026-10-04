import { PluginError } from "../../kernel/errors/index.js";
import type { AuditSink, Clock } from "../../types/internal.js";
import type { TypedEventBus } from "../event/bus.js";
import type { TrustStore } from "../../security/trust-store.js";
import type { PluginManifest } from "./manifest.js";
import type { PluginRegistry } from "./registry.js";
import { createSandboxPolicy, type SandboxPolicy } from "./sandbox/policy.js";
import type { SandboxHost } from "./sandbox/host.js";
import { verifyPlugin, type PluginVerificationDeps } from "./verifier.js";

/** Options passed to the sandbox opener for one plugin instance. */
export interface SandboxOpenOptions {
  readonly pluginName: string;
  readonly policy: SandboxPolicy;
}

/** Dependencies of the plugin loader. Sandbox opening is injected per transport. */
export interface PluginLoaderDeps {
  readonly trustStore: TrustStore;
  readonly currentVersion: string;
  readonly registry: PluginRegistry;
  readonly openSandbox: (options: SandboxOpenOptions) => SandboxHost;
  readonly audit?: AuditSink;
  readonly bus?: TypedEventBus;
  readonly clock: Clock;
  readonly correlationId?: string;
}

/**
 * Loads one plugin: verifies manifest, hash, signature, publisher, and engine
 * range, then opens a sandbox with the declared permissions and registers the
 * handle. A failed verification never opens a sandbox and throws PluginError
 * after the audit entry and plugin:rejected event are written.
 */
export async function loadPlugin(
  deps: PluginLoaderDeps,
  manifestInput: unknown,
  bundle: Uint8Array,
  entrySpecifier: string,
): Promise<PluginManifest> {
  const correlationId = deps.correlationId ?? "plugin-load";
  const verificationDeps: PluginVerificationDeps = {
    trustStore: deps.trustStore,
    currentVersion: deps.currentVersion,
    correlationId,
    now: deps.clock.now,
    ...(deps.audit === undefined ? {} : { audit: deps.audit }),
    ...(deps.bus === undefined ? {} : { bus: deps.bus }),
  };
  const verification = await verifyPlugin(manifestInput, bundle, verificationDeps);
  if (!verification.ok) {
    throw new PluginError({
      message: `plugin verification failed: ${verification.reason}`,
      context: { reason: verification.reason },
      correlationId,
    });
  }
  const manifest = verification.manifest;
  if (deps.registry.get(manifest.name) !== undefined) {
    throw new PluginError({
      message: `plugin already loaded: ${manifest.name}`,
      context: { plugin: manifest.name },
      correlationId,
    });
  }
  const policy = createSandboxPolicy(manifest.permissions);
  const host = deps.openSandbox({ pluginName: manifest.name, policy });
  try {
    await host.invokeHandler("activate", { entry: entrySpecifier });
  } catch (cause) {
    host.close();
    throw cause instanceof PluginError
      ? cause
      : new PluginError({
          message: `plugin activation failed: ${manifest.name}`,
          cause,
          context: { plugin: manifest.name },
          correlationId,
        });
  }
  deps.registry.set({ manifest, host });
  if (deps.audit !== undefined) {
    deps.audit.write({
      timestamp: new Date(deps.clock.now()).toISOString(),
      actor: "plugin-loader",
      action: "plugin:loaded",
      target: manifest.name,
      result: "ok",
      correlationId,
      metadata: { version: manifest.version },
    });
  }
  if (deps.bus !== undefined) {
    deps.bus.emit("plugin:loaded", {
      kind: "plugin:loaded",
      name: manifest.name,
      version: manifest.version,
      correlationId,
    });
  }
  return manifest;
}

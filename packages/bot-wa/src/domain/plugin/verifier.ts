import { sha256Hex } from "../../security/hash.js";
import { verifySignature } from "../../security/sign.js";
import type { TrustStore } from "../../security/trust-store.js";
import type { ConfigIssue } from "../../kernel/config/schema.js";
import type { AuditSink } from "../../types/internal.js";
import type { TypedEventBus } from "../event/bus.js";
import type { PluginManifest } from "./manifest.js";
import { validateManifest } from "./manifest.js";
import { satisfiesSemverRange } from "./semver.js";

/** Reason a plugin failed verification. Written to audit and emitted as plugin:rejected. */
export type VerificationFailureReason =
  | "manifest-invalid"
  | "hash-mismatch"
  | "signature-invalid"
  | "publisher-untrusted"
  | "publisher-revoked"
  | "engine-range-mismatch";

/** Dependencies of the verifier. Audit and bus are optional report channels. */
export interface PluginVerificationDeps {
  readonly trustStore: TrustStore;
  readonly currentVersion: string;
  readonly audit?: AuditSink;
  readonly bus?: TypedEventBus;
  readonly correlationId?: string;
  readonly now?: () => number;
}

/** Outcome of plugin verification. */
export type PluginVerification =
  | { readonly ok: true; readonly manifest: PluginManifest }
  | {
      readonly ok: false;
      readonly reason: VerificationFailureReason;
      readonly issues?: readonly ConfigIssue[];
    };

function fail(
  deps: PluginVerificationDeps,
  manifest: PluginManifest | null,
  reason: VerificationFailureReason,
  correlationId: string,
  issues?: readonly ConfigIssue[],
): PluginVerification {
  const name = manifest === null ? "unknown" : manifest.name;
  const now: () => number = deps.now === undefined ? () => Date.now() : deps.now;
  if (deps.audit !== undefined) {
    deps.audit.write({
      timestamp: new Date(now()).toISOString(),
      actor: "plugin-verifier",
      action: "plugin:verify",
      target: name,
      result: "error",
      correlationId,
      metadata: { reason },
    });
  }
  if (deps.bus !== undefined) {
    deps.bus.emit("plugin:rejected", { kind: "plugin:rejected", name, reason, correlationId });
  }
  return issues === undefined ? { ok: false, reason } : { ok: false, reason, issues };
}

/**
 * Verifies a plugin bundle against its manifest, steps one to six:
 * schema, SHA-256 hash, Ed25519 signature, publisher trust, revocation,
 * and engine version range. Sandbox loading is step seven and lives elsewhere.
 * A failed check never runs the plugin and is reported to audit and the bus.
 */
export async function verifyPlugin(
  manifestInput: unknown,
  bundle: Uint8Array,
  deps: PluginVerificationDeps,
): Promise<PluginVerification> {
  const correlationId = deps.correlationId ?? "plugin-verify";
  const validation = validateManifest(manifestInput);
  if (!validation.ok) {
    return fail(deps, null, "manifest-invalid", correlationId, validation.issues);
  }
  const manifest = validation.value;
  const actualHash = sha256Hex(bundle);
  if (actualHash !== manifest.hash) {
    return fail(deps, manifest, "hash-mismatch", correlationId);
  }
  if (!verifySignature(manifest.hash, manifest.signature, manifest.publisher)) {
    return fail(deps, manifest, "signature-invalid", correlationId);
  }
  const present = await deps.trustStore.has(manifest.publisher);
  if (!present) {
    return fail(deps, manifest, "publisher-untrusted", correlationId);
  }
  const revoked = await deps.trustStore.isRevoked(manifest.publisher);
  if (revoked) {
    return fail(deps, manifest, "publisher-revoked", correlationId);
  }
  if (!satisfiesSemverRange(deps.currentVersion, manifest.engines)) {
    return fail(deps, manifest, "engine-range-mismatch", correlationId);
  }
  return { ok: true, manifest };
}

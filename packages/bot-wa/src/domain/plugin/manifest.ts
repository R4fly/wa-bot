import type { ConfigIssue } from "../../kernel/config/schema.js";

/** Granular plugin permissions. Undeclared permissions are never granted. */
export const PLUGIN_PERMISSIONS = [
  "read:message",
  "send:message",
  "access:storage",
  "access:network",
  "access:fs",
  "access:scheduler",
  "access:session",
  "admin:group",
] as const;

/** One declarable plugin permission. */
export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

/** Full plugin manifest as declared in plugin.json. */
export interface PluginManifest {
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly license: string;
  readonly engines: string;
  readonly permissions: readonly PluginPermission[];
  readonly entry: string;
  readonly hash: string;
  readonly signature: string;
  readonly publisher: string;
}

/** Result of manifest schema validation. */
export type ManifestValidation =
  | { readonly ok: true; readonly value: PluginManifest }
  | { readonly ok: false; readonly issues: readonly ConfigIssue[] };

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/=]+$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkString(issues: ConfigIssue[], field: string, value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    issues.push({ field, received: value, expected: "non-empty string" });
    return undefined;
  }
  return value;
}

function checkPattern(
  issues: ConfigIssue[],
  field: string,
  value: string | undefined,
  pattern: RegExp,
  expected: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!pattern.test(value)) {
    issues.push({ field, received: value, expected });
    return undefined;
  }
  return value;
}

function checkEntry(issues: ConfigIssue[], value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const segments = value.split("/");
  const escapes =
    value.startsWith("/") ||
    value.includes("\\") ||
    value.startsWith("..") ||
    segments.includes("..");
  if (escapes) {
    issues.push({ field: "entry", received: value, expected: "relative path inside the plugin root" });
    return undefined;
  }
  return value;
}

function checkPermissions(issues: ConfigIssue[], value: unknown): readonly PluginPermission[] | undefined {
  if (!Array.isArray(value)) {
    issues.push({ field: "permissions", received: value, expected: "array of permission strings" });
    return undefined;
  }
  const seen = new Set<string>();
  const out: PluginPermission[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !(PLUGIN_PERMISSIONS as readonly string[]).includes(item)) {
      issues.push({ field: "permissions", received: item, expected: `one of ${PLUGIN_PERMISSIONS.join(", ")}` });
      return undefined;
    }
    if (seen.has(item)) {
      issues.push({ field: "permissions", received: item, expected: "unique permission values" });
      return undefined;
    }
    seen.add(item);
    out.push(item as PluginPermission);
  }
  return out;
}

/** Validates an unknown object against the plugin manifest schema. */
export function validateManifest(input: unknown): ManifestValidation {
  const issues: ConfigIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [{ field: "(root)", received: input, expected: "object" }] };
  }
  const name = checkString(issues, "name", input["name"]);
  const version = checkPattern(
    issues,
    "version",
    checkString(issues, "version", input["version"]),
    VERSION_PATTERN,
    "semantic version x.y.z",
  );
  const author = checkString(issues, "author", input["author"]);
  const license = checkString(issues, "license", input["license"]);
  const engines = checkString(issues, "engines", input["engines"]);
  const permissions = checkPermissions(issues, input["permissions"]);
  const entry = checkEntry(issues, checkString(issues, "entry", input["entry"]));
  const hash = checkPattern(
    issues,
    "hash",
    checkString(issues, "hash", input["hash"]),
    HASH_PATTERN,
    "64 lowercase hex characters",
  );
  const signature = checkPattern(
    issues,
    "signature",
    checkString(issues, "signature", input["signature"]),
    BASE64_PATTERN,
    "base64 string",
  );
  const publisher = checkPattern(
    issues,
    "publisher",
    checkString(issues, "publisher", input["publisher"]),
    BASE64_PATTERN,
    "base64 public key",
  );
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      name: name as string,
      version: version as string,
      author: author as string,
      license: license as string,
      engines: engines as string,
      permissions: permissions as readonly PluginPermission[],
      entry: entry as string,
      hash: hash as string,
      signature: signature as string,
      publisher: publisher as string,
    },
  };
}

const REDACTED = "[REDACTED]";

const SENSITIVE_FIELD = /(token|apikey|api_key|password|passwd|secret|authorization|privatekey|signingkey|credential|sessionkey)/i;

const STRING_PATTERNS: readonly RegExp[] = [
  /ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/=]{8,}/gi,
  /\b[0-9a-f]{32,}\b/gi,
  /\b[A-Za-z0-9+/=_-]{40,}\b/g,
];

function redactString(value: string): string {
  let out = value;
  for (const pattern of STRING_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

/**
 * Deep redaction of field names and string patterns.
 * Runs before any log sink. Best effort by design: unknown secret formats
 * can pass, so callers must never log raw objects on risky paths.
 */
export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_FIELD.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redact(item);
      }
    }
    return out;
  }
  return value;
}

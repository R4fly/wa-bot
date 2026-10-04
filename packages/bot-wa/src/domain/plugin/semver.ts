/** Parsed semantic version without prerelease or build metadata. */
export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Parses an exact x.y.z version string. Returns null when malformed. */
export function parseSemver(input: string): SemVer | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(input.trim());
  if (match === null) {
    return null;
  }
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/** Compares two versions. Negative when a is lower, positive when higher, zero when equal. */
export function compareSemver(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) {
    return a.major < b.major ? -1 : 1;
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor ? -1 : 1;
  }
  if (a.patch !== b.patch) {
    return a.patch < b.patch ? -1 : 1;
  }
  return 0;
}

function satisfiesConstraint(version: SemVer, constraint: string): boolean {
  const trimmed = constraint.trim();
  if (trimmed.startsWith("^")) {
    const base = parseSemver(trimmed.slice(1));
    if (base === null) {
      return false;
    }
    const upper: SemVer =
      base.major > 0
        ? { major: base.major + 1, minor: 0, patch: 0 }
        : base.minor > 0
          ? { major: 0, minor: base.minor + 1, patch: 0 }
          : { major: 0, minor: 0, patch: base.patch + 1 };
    return compareSemver(version, base) >= 0 && compareSemver(version, upper) < 0;
  }
  if (trimmed.startsWith("~")) {
    const base = parseSemver(trimmed.slice(1));
    if (base === null) {
      return false;
    }
    const upper: SemVer = { major: base.major, minor: base.minor + 1, patch: 0 };
    return compareSemver(version, base) >= 0 && compareSemver(version, upper) < 0;
  }
  if (trimmed.startsWith(">=")) {
    const base = parseSemver(trimmed.slice(2));
    return base !== null && compareSemver(version, base) >= 0;
  }
  if (trimmed.startsWith("<=")) {
    const base = parseSemver(trimmed.slice(2));
    return base !== null && compareSemver(version, base) <= 0;
  }
  if (trimmed.startsWith(">")) {
    const base = parseSemver(trimmed.slice(1));
    return base !== null && compareSemver(version, base) > 0;
  }
  if (trimmed.startsWith("<")) {
    const base = parseSemver(trimmed.slice(1));
    return base !== null && compareSemver(version, base) < 0;
  }
  if (trimmed.startsWith("=")) {
    const base = parseSemver(trimmed.slice(1));
    return base !== null && compareSemver(version, base) === 0;
  }
  const exact = parseSemver(trimmed);
  return exact !== null && compareSemver(version, exact) === 0;
}

/**
 * Checks a version against a range of space separated AND constraints.
 * Supported operators: >=, <=, >, <, =, caret, and tilde.
 */
export function satisfiesSemverRange(version: string, range: string): boolean {
  const parsed = parseSemver(version);
  if (parsed === null) {
    return false;
  }
  const constraints = range.trim().split(/\s+/).filter((item) => item.length > 0);
  if (constraints.length === 0) {
    return false;
  }
  return constraints.every((constraint) => satisfiesConstraint(parsed, constraint));
}

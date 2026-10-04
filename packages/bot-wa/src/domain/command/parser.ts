/** Result of argument parsing: positional values, flags, and rest args. */
export interface ParsedArgs {
  readonly positional: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
  readonly rest: readonly string[];
}

function tokenize(input: string): string[] {
  const out: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null = pattern.exec(input);
  while (match !== null) {
    out.push(match[1] ?? match[2] ?? match[3] ?? "");
    match = pattern.exec(input);
  }
  return out;
}

/**
 * Parses a raw argument string.
 * Supports quoted strings, --flag value, --flag=value, boolean --flag,
 * and rest args after a bare double dash.
 */
export function parseArgs(input: string): ParsedArgs {
  const tokens = tokenize(input);
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];
  let restMode = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as string;
    if (restMode) {
      rest.push(token);
      continue;
    }
    if (token === "--") {
      restMode = true;
      continue;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq !== -1) {
        flags[token.slice(2, eq)] = token.slice(eq + 1);
        continue;
      }
      const next = tokens[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[token.slice(2)] = next;
        i += 1;
      } else {
        flags[token.slice(2)] = true;
      }
      continue;
    }
    positional.push(token);
  }
  return { positional, flags, rest };
}

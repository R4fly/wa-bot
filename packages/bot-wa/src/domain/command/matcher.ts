/** Successful command match with the raw argument substring. */
export interface MatchResult {
  readonly name: string;
  readonly argsRaw: string;
}

/**
 * Matches a message body against configured prefixes, known command names,
 * and alias mappings. Returns null when no command matches.
 */
export function matchCommand(
  body: string,
  prefixes: readonly string[],
  knownNames: readonly string[],
  aliases: Readonly<Record<string, string>>,
): MatchResult | null {
  for (const prefix of prefixes) {
    if (!body.startsWith(prefix)) {
      continue;
    }
    const stripped = body.slice(prefix.length);
    const space = stripped.indexOf(" ");
    const head = space === -1 ? stripped : stripped.slice(0, space);
    if (head.length === 0) {
      continue;
    }
    const lowered = head.toLowerCase();
    const candidate = aliases[lowered] ?? lowered;
    if (knownNames.includes(candidate)) {
      const argsRaw = space === -1 ? "" : stripped.slice(space + 1).trim();
      return { name: candidate, argsRaw };
    }
  }
  return null;
}

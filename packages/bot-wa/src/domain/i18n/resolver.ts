/** Inputs for locale resolution. */
export interface ResolveLocaleInput {
  readonly userLocale?: string;
  readonly groupLocale?: string;
  readonly fallback: string;
  readonly supported: readonly string[];
}

/** Resolves the effective locale: user, then group, then fallback. */
export function resolveLocale(input: ResolveLocaleInput): string {
  const candidates: Array<string | undefined> = [input.userLocale, input.groupLocale, input.fallback];
  for (const candidate of candidates) {
    if (candidate !== undefined && input.supported.includes(candidate)) {
      return candidate;
    }
  }
  return input.fallback;
}

/** Selects a plural form. An exact count key wins, then one or other. */
export function selectPlural(count: number, forms: Readonly<Record<string, string>>): string {
  const exact = forms[String(count)];
  if (exact !== undefined) {
    return exact;
  }
  const key = count === 1 ? "one" : "other";
  return forms[key] ?? forms["other"] ?? "";
}

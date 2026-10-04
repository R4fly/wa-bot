/** Replaces {name} placeholders with string variables. Unknown names stay literal. */
export function interpolate(template: string, vars: Readonly<Record<string, string>>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole: string, name: string): string => {
    const value = vars[name];
    return value === undefined ? whole : value;
  });
}

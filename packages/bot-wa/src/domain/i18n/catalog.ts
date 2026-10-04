import { interpolate } from "./interpolate.js";

/** A message catalog for one locale. */
export interface Catalog {
  readonly locale: string;
  readonly messages: Readonly<Record<string, string>>;
}

/** Creates a catalog for one locale. */
export function createCatalog(locale: string, messages: Readonly<Record<string, string>>): Catalog {
  return { locale, messages };
}

/** Looks up a key and interpolates variables. Falls back to the key when absent. */
export function translate(catalog: Catalog, key: string, vars: Readonly<Record<string, string>> = {}): string {
  const template = catalog.messages[key];
  if (template === undefined) {
    return key;
  }
  return interpolate(template, vars);
}

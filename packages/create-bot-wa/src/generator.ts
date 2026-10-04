import {
  scaffoldTemplate,
  TEMPLATE_NAMES,
  type TemplateName,
} from "@baehaqirafly3/bot-wa-cli/scaffold";

/** Options for one generation run. */
export interface GenerateOptions {
  readonly template: TemplateName;
  readonly projectName: string;
}

/** Result of one generation run. */
export interface GenerateResult {
  readonly created: readonly string[];
}

/** Reports whether a raw string is a known template name. */
export function isTemplateName(value: string): value is TemplateName {
  return (TEMPLATE_NAMES as readonly string[]).includes(value);
}

/**
 * Generates one starter project through the injected writer.
 * Performs no network calls and sends no telemetry.
 */
export async function generate(
  options: GenerateOptions,
  write: (relativePath: string, content: string) => Promise<void>,
): Promise<GenerateResult> {
  const created: string[] = [];
  await scaffoldTemplate(options.template, options.projectName, async (relativePath, content) => {
    created.push(relativePath);
    await write(relativePath, content);
  });
  return { created };
}

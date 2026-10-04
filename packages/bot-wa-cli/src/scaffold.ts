/** Names of the six starter templates. */
export const TEMPLATE_NAMES = [
  "minimal",
  "command-based",
  "group-manager",
  "ai-chatbot",
  "multi-session",
  "blank-ts",
] as const;

/** One starter template name. */
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/** Writer callback so tests can capture files without touching disk. */
export type ScaffoldWriter = (relativePath: string, content: string) => Promise<void>;

function packageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      scripts: { build: "tsc -p tsconfig.json", start: "node dist/index.js" },
      dependencies: { "@baehaqirafly3/bot-wa": "^0.1.0" },
    },
    null,
    2,
  );
}

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      outDir: "dist",
    },
    include: ["src"],
  },
  null,
  2,
);

const ENV_EXAMPLE = "BOTWA_ENGINE_NAME=baileys\nBOTWA_SESSION_STORAGE=file\n";

function entryFor(template: TemplateName): string {
  if (template === "minimal") {
    return `import { createBot } from "@baehaqirafly3/bot-wa";\n\nconst bot = await createBot();\nbot.command("ping", { description: "pong back" }, async (ctx) => {\n  await ctx.reply("pong");\n});\nawait bot.start();\n`;
  }
  if (template === "multi-session") {
    return `import { createBot } from "@baehaqirafly3/bot-wa";\n\nconst first = await createBot({ cli: { SESSION_NAME: "one" } });\nconst second = await createBot({ cli: { SESSION_NAME: "two" } });\nawait first.start();\nawait second.start();\n`;
  }
  if (template === "ai-chatbot") {
    return `import { createBot } from "@baehaqirafly3/bot-wa";\n\nconst provider = process.env.LLM_PROVIDER_URL ?? "";\nconst bot = await createBot();\nbot.command("ask", { description: "ask the provider" }, async (ctx) => {\n  await ctx.reply(\`provider configured: \${provider.length > 0}\`);\n});\nawait bot.start();\n`;
  }
  if (template === "group-manager") {
    return `import { createBot } from "@baehaqirafly3/bot-wa";\nimport { antiLinkMiddleware, onlyGroupMiddleware } from "@baehaqirafly3/bot-wa";\n\nconst bot = await createBot();\nbot.use(onlyGroupMiddleware());\nbot.use(antiLinkMiddleware({ whitelist: [] }));\nawait bot.start();\n`;
  }
  if (template === "command-based") {
    return `import { createBot } from "@baehaqirafly3/bot-wa";\nimport { pingCommand } from "./commands/ping.js";\n\nconst bot = await createBot();\nbot.command("ping", pingCommand.options, pingCommand.handler);\nawait bot.start();\n`;
  }
  return `import { createBot } from "@baehaqirafly3/bot-wa";\n\nconst bot = await createBot();\nawait bot.start();\n`;
}

/** Writes one starter template through the injected writer. */
export async function scaffoldTemplate(
  template: TemplateName,
  projectName: string,
  write: ScaffoldWriter,
): Promise<void> {
  await write("package.json", packageJson(projectName));
  await write("tsconfig.json", TSCONFIG);
  await write(".env.example", ENV_EXAMPLE);
  await write("README.md", `# ${projectName}\n\nStarter template ${template} for @baehaqirafly3/bot-wa.\n`);
  await write("bot-wa.config.ts", `export default {\n  engine: { name: "baileys" },\n};\n`);
  await write("src/index.ts", entryFor(template));
  if (template === "command-based") {
    await write(
      "src/commands/ping.ts",
      `import type { BotCommandOptions } from "@baehaqirafly3/bot-wa";\nimport type { MessageContext } from "@baehaqirafly3/bot-wa";\n\nexport const pingCommand: {\n  options: BotCommandOptions;\n  handler: (ctx: MessageContext) => Promise<void>;\n} = {\n  options: { description: "pong back" },\n  handler: async (ctx) => {\n    await ctx.reply("pong");\n  },\n};\n`,
    );
  }
}

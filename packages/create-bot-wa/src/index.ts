import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { TEMPLATE_NAMES } from "@baehaqirafly3/bot-wa-cli/scaffold";
import { generate, isTemplateName } from "./generator.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let template = args[0] ?? "";
    if (!isTemplateName(template)) {
      template = await rl.question(`template (${TEMPLATE_NAMES.join(", ")}): `);
      if (!isTemplateName(template)) {
        process.stderr.write("unknown template\n");
        process.exitCode = 2;
        return;
      }
    }
    const answered = await rl.question("project name: ");
    const projectName = answered.length > 0 ? answered : template;
    const dir = join(process.cwd(), projectName);
    await mkdir(dir, { recursive: true });
    const result = await generate({ template, projectName }, async (relativePath, content) => {
      await writeFile(join(dir, relativePath), content, "utf8");
    });
    process.stdout.write(`created ${result.created.length} files in ${dir}\n`);
    process.stdout.write(`next: cd ${projectName}, then npm install, then npm start\n`);
  } finally {
    rl.close();
  }
}

void main();

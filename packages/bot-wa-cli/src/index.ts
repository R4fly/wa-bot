import { run, type CliIo } from "./cli.js";

const io: CliIo = {
  stdout: (line: string): void => {
    process.stdout.write(`${line}\n`);
  },
  stderr: (line: string): void => {
    process.stderr.write(`${line}\n`);
  },
};

async function main(): Promise<void> {
  process.exitCode = await run(process.argv.slice(2), { io });
}

void main();

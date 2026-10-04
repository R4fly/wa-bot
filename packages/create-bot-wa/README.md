# @baehaqirafly3/create-bot-wa

Project generator for [@baehaqirafly3/bot-wa](https://www.npmjs.com/package/@baehaqirafly3/bot-wa). Six starter templates, fully offline generation, zero telemetry.

## Usage

Interactive, the recommended path:

```sh
npm create @baehaqirafly3/bot-wa@latest
```

You are asked for a template name and a project name. The generator writes the project into a folder named after the project inside the current directory.

With the template preselected:

```sh
npm create @baehaqirafly3/bot-wa@latest -- minimal my-bot
```

The project name is still read from stdin, so this form is ideal for scripts that pipe the name.

Use the pre-release channel with `@next` in place of `@latest`.

## Offline and privacy guarantees

- Generation performs no network calls. Templates are embedded in the package.
- No telemetry, no analytics, no postinstall hooks, no account features. Ever.
- The only network step afterwards is your own `npm install` inside the generated project.

## Templates

| Template | What it demonstrates | Extra files |
| --- | --- | --- |
| minimal | One command with a reply | none |
| command-based | Commands split into modules | `src/commands/ping.ts` |
| group-manager | Group-only scope plus anti-link middleware | none |
| ai-chatbot | Provider URL wired from environment | none |
| multi-session | Two sessions in one process | none |
| blank-ts | Empty bot, ready for your own structure | none |

Every template contains:

```
package.json
tsconfig.json
.env.example
README.md
bot-wa.config.ts
src/index.ts
```

## After generation

```sh
cd my-bot
npm install
npm start
```

On Node 20 without native type stripping, build first with `npm run build` then run `node dist/index.js`.

## Programmatic use

The interactive wrapper is thin. The real generation logic lives in the scaffold subpath export of the CLI package, which is what you want in your own tooling:

```ts
import { scaffoldTemplate, TEMPLATE_NAMES } from "@baehaqirafly3/bot-wa-cli/scaffold";

await scaffoldTemplate("minimal", "my-bot", async (relativePath, content) => {
  // write content to relativePath wherever you like
});
```

`TEMPLATE_NAMES` is the frozen list of six template ids. `scaffoldTemplate` calls your writer once per file and never touches the filesystem itself, which makes it trivial to test.

## License

MIT. See `LICENSE`.
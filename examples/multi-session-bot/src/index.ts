import { createBot } from "@baehaqirafly3/bot-wa";

const first = await createBot({ cli: { SESSION_NAME: "one" } });
const second = await createBot({ cli: { SESSION_NAME: "two" } });

first.command("ping", { description: "pong back" }, async (ctx) => {
  await ctx.reply("pong from one");
});

second.command("ping", { description: "pong back" }, async (ctx) => {
  await ctx.reply("pong from two");
});

await first.start();
await second.start();
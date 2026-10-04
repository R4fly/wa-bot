import { createBot } from "@baehaqirafly3/bot-wa";

const bot = await createBot();

bot.command("echo", { description: "Echo the argument back" }, async (ctx, args) => {
  await ctx.reply(args.positional.join(" "));
});

await bot.start();
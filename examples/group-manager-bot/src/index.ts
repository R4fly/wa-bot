import { antiLinkMiddleware, createBot, onlyGroupMiddleware } from "@baehaqirafly3/bot-wa";

const bot = await createBot();

bot.use(onlyGroupMiddleware());
bot.use(antiLinkMiddleware({ whitelist: ["github.com"] }));

bot.command(
  "subject",
  { description: "Set the group subject", permission: "admin" },
  async (ctx, args) => {
    await ctx.reply(`subject requested: ${args.positional.join(" ")}`);
  },
);

await bot.start();
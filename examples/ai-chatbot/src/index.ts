import { createBot } from "@baehaqirafly3/bot-wa";

const providerUrl = process.env.LLM_PROVIDER_URL ?? "";

const bot = await createBot();

bot.command("ask", { description: "Ask the configured provider" }, async (ctx, args) => {
  if (providerUrl.length === 0) {
    await ctx.reply("LLM_PROVIDER_URL is not set");
    return;
  }
  await ctx.reply(`would send to provider: ${args.positional.join(" ")}`);
});

await bot.start();
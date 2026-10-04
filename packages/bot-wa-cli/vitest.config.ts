import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@baehaqirafly3\/bot-wa$/,
        replacement: fileURLToPath(new URL("../bot-wa/src/index.ts", import.meta.url)),
      },
      {
        find: /^@baehaqirafly3\/bot-wa-shared$/,
        replacement: fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
      },
    ],
  },
});

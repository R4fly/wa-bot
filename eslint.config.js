import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

const SRC = "./packages/bot-wa/src";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "landing/**", "**/*.cjs"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: `${SRC}/kernel/**/*`,
              from: [
                `${SRC}/infra/**/*`,
                `${SRC}/adapters/**/*`,
                `${SRC}/domain/**/*`,
                `${SRC}/session/**/*`,
                `${SRC}/security/**/*`,
                `${SRC}/observability/**/*`,
                `${SRC}/util/**/*`,
              ],
            },
            {
              target: `${SRC}/infra/**/*`,
              from: [
                `${SRC}/adapters/**/*`,
                `${SRC}/domain/**/*`,
                `${SRC}/session/**/*`,
                `${SRC}/security/**/*`,
                `${SRC}/observability/**/*`,
              ],
            },
            {
              target: `${SRC}/adapters/**/*`,
              from: [
                `${SRC}/domain/**/*`,
                `${SRC}/session/**/*`,
                `${SRC}/security/**/*`,
                `${SRC}/observability/**/*`,
              ],
            },
            {
              target: `${SRC}/domain/**/*`,
              from: [`${SRC}/session/**/*`],
            },
          ],
        },
      ],
    },
  },
);

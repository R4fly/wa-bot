import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/domain/plugin/sandbox/worker-entry.ts"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
        "src/domain/**": {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85,
        },
      },
    },
  },
});
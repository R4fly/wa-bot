import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/domain/plugin/sandbox/worker-entry.ts"],
  format: ["esm", "cjs"],
  dts: {
    entry: "src/index.ts",
  },
  sourcemap: true,
  clean: true,
  target: "node20",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});

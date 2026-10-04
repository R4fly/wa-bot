import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "worker-entry": "src/domain/plugin/sandbox/worker-entry.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    entry: "src/index.ts",
  },
  sourcemap: true,
  clean: true,
  target: "node20",
  shims: true,
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});

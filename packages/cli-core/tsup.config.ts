import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  target: "node20",
  dts: false,
  sourcemap: true,
  clean: true,
});

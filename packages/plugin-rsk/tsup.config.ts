import { defineConfig } from "tsup";
import { NodeResolvePlugin } from "@esbuild-plugins/node-resolve";

export default defineConfig({
  entry: ["src/index.ts"],
  clean: true,
  target: "node18",
  format: ["esm"],
  sourcemap: true,
  dts: false,
  esbuildPlugins: [
    NodeResolvePlugin({
      extensions: [".ts", ".js"],
      onResolved: (resolved) => {
        if (resolved.includes("node_modules")) {
          return {
            external: true,
          };
        }
        return resolved;
      },
    }),
  ],
}); 
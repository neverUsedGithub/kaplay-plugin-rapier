import { defineConfig } from "vite";
import pluginWasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [pluginWasm()],
});

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: resolve(repositoryRoot, "Sources/SwiftWAVWeb"),
  publicDir: resolve(repositoryRoot, "Public"),
  resolve: {
    alias: {
      // Vapor is shipped as a separate Vue runtime build. A bare `vue`
      // import resolves to the VDOM runtime unless this alias is explicit.
      vue: resolve(repositoryRoot, "node_modules/vue/dist/vue.runtime-with-vapor.esm-browser.js"),
    },
  },
  plugins: [
    vue({
      features: {
        // Vue 3.6 Vapor mode compiles every SFC without a VDOM.
        vapor: true,
      },
    }),
  ],
  worker: {
    format: "es",
  },
  build: {
    outDir: resolve(repositoryRoot, "build"),
    emptyOutDir: true,
    sourcemap: true,
  },
});

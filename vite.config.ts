import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const repositoryRoot = (path: string) => resolve(fileURLToPath(new URL(".", import.meta.url)), path);

export default defineConfig({
  root: repositoryRoot("Public"),
  publicDir: repositoryRoot("Public/static"),
  resolve: {
    alias: {
      // Vapor is shipped as a separate Vue runtime build. A bare `vue`
      // import resolves to the VDOM runtime unless this alias is explicit.
      vue: repositoryRoot("node_modules/vue/dist/vue.runtime-with-vapor.esm-browser.js"),
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
    outDir: repositoryRoot("dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    proxy: {
      "/toolchain": "http://127.0.0.1:8090",
    },
  },
  preview: {
    proxy: {
      "/toolchain": "http://127.0.0.1:8090",
    },
  },
});

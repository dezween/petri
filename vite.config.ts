import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Served from https://dezween.github.io/petri/ via GitHub Pages (a project site, not a
  // custom domain), so asset URLs must be rooted at the repo name rather than "/".
  base: "/petri/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      // Opts into Dart Sass's modern compiler API — the legacy one Vite defaults to is
      // deprecated and prints a build-time warning on every SCSS compile.
      scss: {
        api: "modern-compiler",
      },
    },
  },
});

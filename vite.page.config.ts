import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: path.resolve(import.meta.dirname, "dist"),
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
      format: { comments: false },
    },
    lib: {
      entry: path.resolve(import.meta.dirname, "src/page/index.ts"),
      name: "spotifyCustomizationPage",
      formats: ["iife"],
      fileName: () => "page.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

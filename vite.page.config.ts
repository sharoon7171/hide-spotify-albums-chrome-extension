import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: path.resolve(__dirname, "dist"),
    lib: {
      entry: path.resolve(__dirname, "src/page/index.ts"),
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

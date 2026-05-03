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
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
      format: { comments: false },
    },
    lib: {
      entry: path.resolve(__dirname, "src/content/index.ts"),
      name: "spotifyCustomizationContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

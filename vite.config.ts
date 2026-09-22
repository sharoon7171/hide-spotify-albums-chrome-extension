import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;

function flattenOptionsHtml(): Plugin {
  return {
    name: "flatten-options-html",
    closeBundle() {
      const dist = path.resolve(root, "dist");
      const nested = path.join(dist, "public/options.html");
      if (!existsSync(nested)) {
        throw new Error("[flatten-options-html] missing dist/public/options.html");
      }
      const html = readFileSync(nested, "utf8")
        .replaceAll("../options.js", "./options.js")
        .replaceAll("../options.css", "./options.css");
      writeFileSync(path.join(dist, "options.html"), html);
      rmSync(path.join(dist, "public"), { recursive: true });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [tailwindcss(), react(), flattenOptionsHtml()],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: false,
    chunkSizeWarningLimit: 2000,
    target: "esnext",
    minify: "terser",
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
      format: { comments: false },
    },
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        options: path.resolve(root, "public/options.html"),
      },
      output: {
        entryFileNames: "options.js",
        assetFileNames: (asset: { name?: string }) => {
          if (asset.name?.endsWith(".css")) return "options.css";
          return "[name][extname]";
        },
      },
    },
  },
});

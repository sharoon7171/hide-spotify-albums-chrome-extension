import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function copyExtensionRootFiles(): Plugin {
  const names = ["manifest.json"];
  return {
    name: "copy-extension-root-files",
    writeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      for (const name of names) {
        const from = path.resolve(__dirname, name);
        if (existsSync(from)) {
          copyFileSync(from, path.join(outDir, name));
        }
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [tailwindcss(), react(), copyExtensionRootFiles()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: path.resolve(__dirname, "src/background/index.ts"),
        options: path.resolve(__dirname, "options.html"),
      },
      output: {
        entryFileNames(chunk: { name: string | undefined }) {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "options") return "options.js";
          return "[name].js";
        },
        chunkFileNames: "[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});

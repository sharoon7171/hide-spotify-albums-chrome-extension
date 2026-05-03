import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

function buildManifest(env: Record<string, string>): Plugin {
  const TEMPLATE = "manifest.template.json";
  const TOKEN_RE = /\$\{(VITE_[A-Z0-9_]+)\}/g;
  return {
    name: "build-manifest",
    writeBundle() {
      const templatePath = path.resolve(__dirname, TEMPLATE);
      if (!existsSync(templatePath)) {
        throw new Error(`[build-manifest] missing ${TEMPLATE}`);
      }
      const raw = readFileSync(templatePath, "utf8");
      const missing = new Set<string>();
      const rendered = raw.replace(TOKEN_RE, (_, key: string) => {
        const v = env[key];
        if (!v) {
          missing.add(key);
          return "";
        }
        return v;
      });
      if (missing.size > 0) {
        throw new Error(
          `[build-manifest] missing env vars: ${[...missing].join(", ")}. ` +
            `Copy .env.example to .env and fill them in.`,
        );
      }
      try {
        JSON.parse(rendered);
      } catch (e) {
        throw new Error(
          `[build-manifest] templated manifest is not valid JSON: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
      writeFileSync(path.resolve(__dirname, "dist/manifest.json"), rendered);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "./",
    plugins: [tailwindcss(), react(), buildManifest(env)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    publicDir: false,
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
          options: path.resolve(__dirname, "options.html"),
        },
        output: {
          entryFileNames: "options.js",
          assetFileNames: (asset: { name?: string }) => {
            if (asset.name === "options.html") return "options.html";
            if (asset.name?.endsWith(".css")) return "options.css";
            return "[name][extname]";
          },
        },
      },
    },
  };
});

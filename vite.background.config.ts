import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const define: Record<string, string> = {};
  for (const key of Object.keys(env)) {
    if (!key.startsWith("VITE_")) continue;
    define[`import.meta.env.${key}`] = JSON.stringify(env[key]);
  }
  return {
    base: "./",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    define,
    publicDir: false,
    build: {
      emptyOutDir: false,
      outDir: path.resolve(__dirname, "dist"),
      chunkSizeWarningLimit: 2000,
      target: "esnext",
      minify: "terser",
      terserOptions: {
        compress: { drop_console: true, drop_debugger: true, passes: 2 },
        format: { comments: false },
      },
      lib: {
        entry: path.resolve(__dirname, "src/background/index.ts"),
        formats: ["es"],
        fileName: () => "background.js",
      },
    },
  };
});

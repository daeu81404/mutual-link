import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import environment from "vite-plugin-environment";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: "../../.env" });

export default defineConfig({
  base: "./",
  build: {
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: "es2020",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2020",
      define: {
        global: "globalThis",
      },
    },
  },
  plugins: [
    react(),
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    environment("all", { prefix: "VITE_" }),
  ],
  resolve: {
    alias: {
      declarations: fileURLToPath(new URL("../declarations", import.meta.url)),
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    global: "globalThis",
    "process.env": process.env,
  },
});

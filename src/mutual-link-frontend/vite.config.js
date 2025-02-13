import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import environment from "vite-plugin-environment";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: "../../.env" });

// 환경 변수 로깅
console.log("=== Vite Config Environment Variables ===");
console.log("process.env.DFX_NETWORK:", process.env.DFX_NETWORK);
console.log(
  "process.env.CANISTER_ID_MUTUAL_LINK_BACKEND:",
  process.env.CANISTER_ID_MUTUAL_LINK_BACKEND
);
console.log("전체 process.env:", process.env);

export default defineConfig({
  base: "./",
  mode: "development",
  build: {
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "antd"],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "cornerstone-core",
      "cornerstone-tools",
      "cornerstone-wado-image-loader",
      "dicom-parser",
      "hammerjs",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target:
          process.env.VITE_DFX_NETWORK === "ic"
            ? "https://ic0.app"
            : "http://127.0.0.1:4943",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  plugins: [
    react(),
    environment("all", { prefix: "CANISTER_" }),
    environment("all", { prefix: "DFX_" }),
    environment("all", { prefix: "VITE_" }),
    {
      name: "configure-antd-globals",
      transformIndexHtml() {
        return [
          {
            tag: "script",
            attrs: { type: "text/javascript" },
            children: `
              window.global = window;
              const theme = {};
              Object.assign(globalThis, {
                getRootPrefixCls: () => "ant",
                getPrefixCls: (suffixCls, customizePrefixCls) => customizePrefixCls || 'ant-' + suffixCls,
                getPopupContainer: (node) => node?.parentNode || document.body,
                getIconPrefixCls: () => "anticon",
                iconPrefixCls: "anticon",
                csp: { nonce: "" },
                theme: theme,
                getTheme: () => theme,
                getDesignToken: () => ({}),
                getComponentSize: () => "middle",
                getPrefixClassName: (suffixCls, customizePrefixCls) => customizePrefixCls || 'ant-' + suffixCls
              });
            `,
            injectTo: "head-prepend",
          },
        ];
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: "declarations",
        replacement: fileURLToPath(new URL("../declarations", import.meta.url)),
      },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
    dedupe: [
      "@dfinity/agent",
      "antd",
      "cornerstone-core",
      "cornerstone-tools",
      "cornerstone-wado-image-loader",
      "dicom-parser",
    ],
  },
  define: {
    global: "globalThis",
    __DFX_NETWORK__: JSON.stringify(process.env.DFX_NETWORK),
    __CANISTER_ID_MUTUAL_LINK_BACKEND__: JSON.stringify(
      process.env.CANISTER_ID_MUTUAL_LINK_BACKEND
    ),
    "import.meta.env.DFX_NETWORK": JSON.stringify(process.env.DFX_NETWORK),
    "import.meta.env.CANISTER_ID_MUTUAL_LINK_BACKEND": JSON.stringify(
      process.env.CANISTER_ID_MUTUAL_LINK_BACKEND
    ),
    "process.env": {
      DFX_NETWORK: process.env.DFX_NETWORK,
      CANISTER_ID_MUTUAL_LINK_BACKEND:
        process.env.CANISTER_ID_MUTUAL_LINK_BACKEND,
    },
  },
});

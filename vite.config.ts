import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";

function copySoundsPlugin(): Plugin {
  const copy = () => {
    const src = path.resolve(__dirname, "sounds");
    const dest = path.resolve(__dirname, "public/sounds");
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      if (file.endsWith(".wav") || file.endsWith(".mp3")) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }
    }
  };

  return {
    name: "copy-sounds",
    buildStart: copy,
    configureServer: copy,
  };
}

export default defineConfig({
  plugins: [react(), copySoundsPlugin()],
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist/web",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@game": path.resolve(__dirname, "src/game"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});

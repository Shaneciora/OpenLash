import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "src/game/**/*.test.ts"],
    fileParallelism: true,
    pool: "threads",
    coverage: {
      provider: "v8",
      include: ["src/game/**"],
      thresholds: {
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@game": path.resolve(__dirname, "src/game"),
    },
  },
});

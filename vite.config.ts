import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/reflexo-em-orbita/" : "/",
  plugins: [react()],
  test: { include: ["src/**/*.test.ts"] },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});

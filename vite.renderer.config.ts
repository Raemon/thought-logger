/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    sourcemap: true,
  },
  test: {
    include: ["tests/renderer/**/*.spec.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [{ browser: "chromium" }],
    },
  },
});

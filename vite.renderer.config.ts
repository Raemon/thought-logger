/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
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

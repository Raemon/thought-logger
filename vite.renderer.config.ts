/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  test: {
    include: ["tests/renderer/**/*.spec.{ts,tsx}"],
    browser: {
      provider: "playwright",
      enabled: true,
      instances: [{ browser: "chromium" }],
    },
  },
});

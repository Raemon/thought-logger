/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
  test: {
    include: ["tests/renderer/**/*.spec.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    browser: {
      provider: "playwright",
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});

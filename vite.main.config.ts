/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      // Add any aliases if needed
    },
  },
  build: {
    rollupOptions: {
      // Remove keytar from externals - we'll handle it separately
      external: [],
    },
    sourcemap: true,
  },
  test: {
    include: ["tests/main/**/*.spec.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});

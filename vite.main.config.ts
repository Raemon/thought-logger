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
      // Keep sql.js bundled so the packaged app can import it.
      // Also: inline dynamic imports to avoid a circular-chunk dependency between
      // the main bundle and the sql.js asm chunk (which can break CJS interop at runtime).
      output: {
        inlineDynamicImports: true,
      },
    },
    sourcemap: true,
  },
  test: {
    include: ["tests/main/**/*.spec.ts"],
    setupFiles: ["tests/setup.ts"],
  },
});

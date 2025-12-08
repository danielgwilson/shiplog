import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000, // 30s for e2e tests
    hookTimeout: 30000,
  },
});

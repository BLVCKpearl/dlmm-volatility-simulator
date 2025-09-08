import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globals: true
  },
  css: {
    // Prevent loading root postcss config during tests
    postcss: {}
  }
});



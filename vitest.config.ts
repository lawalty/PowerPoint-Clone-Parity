import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // UI tests opt into jsdom via a `// @vitest-environment jsdom` pragma.
    testTimeout: 20000,
  },
});

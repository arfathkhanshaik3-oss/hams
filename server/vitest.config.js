import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Tests share ONE database, so files must run one after another
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: { NODE_ENV: 'test' },
  },
});

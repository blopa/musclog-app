import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { testTimeout: 180000, hookTimeout: 60000, include: ['*.test.ts'], fileParallelism: false } });

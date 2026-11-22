import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', include: ['node.spec.mjs'], environment: 'node' } },
      { plugins: [cloudflareTest({ miniflare: { compatibilityDate: '2026-11-01', compatibilityFlags: ['nodejs_compat'] } })],
        test: { name: 'workerd', include: ['worker.spec.mjs'] } },
    ],
  },
});

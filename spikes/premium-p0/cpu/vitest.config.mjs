import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
export default defineConfig({
  plugins: [cloudflareTest({ miniflare: { compatibilityDate: '2026-11-01', compatibilityFlags: ['nodejs_compat'] } })],
  test: { include: ['workerd.spec.mjs'], testTimeout: 60000 },
});

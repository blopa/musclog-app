import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Every test runs inside workerd with a real (Miniflare) D1. Upstreams (RevenueCat,
// OpenRouter) are injected fakes, so no test ever reaches the network.
export default defineConfig({
  // Pin the worker's own tsconfig: test/appClient.test.ts loads the app's utils from outside this
  // package, and the lookup would otherwise find the root tsconfig (`expo/tsconfig.base`), which this
  // job does not install.
  tsconfig: './tsconfig.json',
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.toml', environment: 'test' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, 'migrations')),
        },
      },
    })),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});

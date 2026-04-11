import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: ['**/tests/screenshot-automation.spec.ts'],
  timeout: 600000,
  use: {
    headless: true,
  },
  projects: [
    {
      name: 'portrait-6.5',
      use: {
        // Produces 1242 × 2688px screenshots (iPhone XS Max / 11 Pro Max)
        viewport: { width: 414, height: 896 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'landscape-6.5',
      use: {
        // Produces 2688 × 1242px screenshots
        viewport: { width: 896, height: 414 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'portrait-6.7',
      use: {
        // Produces 1284 × 2778px screenshots (iPhone 13/14/15 Pro Max)
        viewport: { width: 428, height: 926 },
        deviceScaleFactor: 3,
      },
    },
    {
      name: 'landscape-6.7',
      use: {
        // Produces 2778 × 1284px screenshots
        viewport: { width: 926, height: 428 },
        deviceScaleFactor: 3,
      },
    },
  ],
});

import { defineConfig } from '@playwright/test';

// Captures the raw iPhone screens that `scripts/google-play-phone-screenshots.js --target appstore`
// places in a 3D iPhone for the App Store listing. It runs the Play phone spec (same screens, same
// five languages) at the iPhone 17 Pro Max's size: 440 × 956 CSS px at 3× is 1320 × 2868.
export default defineConfig({
  testMatch: ['**/tests/google-play-phone-screenshots.spec.ts'],
  timeout: 600000,
  use: { headless: true },
  projects: [
    {
      name: 'iphone',
      metadata: { outputRoot: 'screenshots/app-store-listing/iphone' },
      use: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 },
    },
  ],
});

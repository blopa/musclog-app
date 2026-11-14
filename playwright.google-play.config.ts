import { defineConfig } from '@playwright/test';

// Captures the tablet screenshots of the Google Play listing. Run through
// `npm run screenshots:google-play`, which then copies them into `android/play/metadata`.
export default defineConfig({
  testMatch: ['**/tests/google-play-screenshots.spec.ts'],
  timeout: 600000,
  use: { headless: true },
  projects: [
    {
      name: 'tablet-7',
      // 768 × 1024px, the size of android/play/metadata/en-US/images/sevenInchScreenshots
      use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 },
    },
    {
      name: 'tablet-10',
      // 1100 × 1466px (the old images were 1467; Play only bounds the ratio), tenInchScreenshots
      use: { viewport: { width: 550, height: 733 }, deviceScaleFactor: 2 },
    },
  ],
});

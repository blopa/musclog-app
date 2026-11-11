import { defineConfig } from '@playwright/test';

// Captures the raw phone screens a separate composer script places in a 3D phone frame for the
// Google Play listing. 360 × 780 CSS px at 3× is exactly 1080 × 2340, the Samsung S25 Ultra
// screen the frame uses.
export default defineConfig({
  testMatch: ['**/tests/google-play-phone-screenshots.spec.ts'],
  timeout: 600000,
  use: { headless: true },
  projects: [
    {
      name: 'phone',
      use: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3 },
    },
  ],
});

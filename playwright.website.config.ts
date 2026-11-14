import { defineConfig } from '@playwright/test';

// Captures the images the public website ships. Run through `npm run screenshots:website`.
export default defineConfig({
  timeout: 600000,
  use: {
    headless: true,
    // For a machine whose installed Chromium is not the build this Playwright version expects.
    launchOptions: process.env.MUSCLOG_CHROMIUM_PATH
      ? { executablePath: process.env.MUSCLOG_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: 'themes',
      testMatch: ['**/tests/website-themes-screenshots.spec.ts'],
      // 1083 × 2340px, the size of public/images/themes/*.webp
      use: { viewport: { width: 361, height: 780 }, deviceScaleFactor: 3 },
    },
    {
      name: 'carousel',
      testMatch: ['**/tests/website-carousel-screenshots.spec.ts'],
      // 537 × 1165px, the size of screenshots/phone/*.png
      use: { viewport: { width: 358, height: 777 }, deviceScaleFactor: 1.5 },
    },
  ],
});

import { defineConfig } from '@playwright/test';

// Captures the iPad screens of the App Store listing, once per bundled language into ipad/<locale> (the IPAD_PRO_3GEN_129 set takes 2048 × 2732 or
// 2064 × 2752). It runs the Google Play tablet spec at the iPad Pro 13-inch's pixel size, 2064 ×
// 2752, as 516 × 688 CSS px at 4×: a wider viewport (the iPad's own 1032 pt) makes the web build
// draw the website's desktop shell (QR code, store links) around the app instead of the app, the
// same reason the Play 10-inch config uses 550 px at 2×. The files are numbered for
// `scripts/appstore.sh screenshots from-captures --kind ipad`.
export default defineConfig({
  testMatch: ['**/tests/google-play-screenshots.spec.ts'],
  timeout: 600000,
  use: { headless: true },
  projects: [
    {
      name: 'ipad',
      metadata: {
        outputRoot: 'screenshots/app-store-listing/ipad',
        numbered: true,
        perLocale: true,
      },
      use: { viewport: { width: 516, height: 688 }, deviceScaleFactor: 4 },
    },
  ],
});
